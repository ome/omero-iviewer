import Context from '../app/context';
import {inject, customElement, bindable, computedFrom} from 'aurelia-framework';
import Ui from '../utils/ui';
import {REGIONS_SHOW_TAGS, LINK_TAG, EventSubscriber} from '../events/events';
import {WEBCLIENT, WEB_API_BASE, TABS} from '../utils/constants';
import {sendRequest} from '../viewers/viewer/utils/Net';

/** localStorage key used to persist the selected_tags ids (in order) */
const SELECTED_TAGS_STORAGE_KEY = 'iviewer_selected_tags';

/**
 * A small, initially hidden, draggable popup for ROI tags
 * @extends {EventSubscriber}
 */
@customElement('regions-tags')
@inject(Context)
export default class RegionsTags extends EventSubscriber {
    /**
     * a bound reference to regions_info
     * @type {RegionsInfo}
     */
    @bindable regions_info = null;

    /** whether the popup is visible */
    visible = false;

    /** @type {Array.<{id: number, value: string}>} */
    tags = [];
    tags_loaded = false;

    /** the group id associated with the tags */
    group_id = null;

    /** list of experimenters in the current group */
    experimenters = [];

    /** text typed into the "All Tags" filter input */
    tags_filter = '';

    /** ownerId selected in the "All Tags" owner filter (null = no filter) */
    tags_owner = null;

    /** @type {Array.<{id: number, value: string}>} */
    selected_tags = [];

    /** which tab is currently showing: 'all' or 'selected' */
    active_tab = 'all';

    /** option to briefly highlight a tab */
    highlighted_tab = null;

    /** the ID of the tag currently highlighted (e.g., on hotkey) */
    highlighted_tagId = null;

    /** popup position in px (viewport coordinates) */
    right = 10;
    top = 100;

    /** popup size in px, adjustable via the bottom-left resize handle */
    width = 320;
    height = 220;

    /** @type {Array.<string,function>} */
    sub_list = [
        [REGIONS_SHOW_TAGS, (args) => {
            this.group_id = args.group_id;
            this.show();
        }],
    ];

    /**
     * @param {Context} context the application context (injected)
     */
    constructor(context) {
        super(context.eventbus);
        this.context = context;
        this.onDragMove = this.onDragMove.bind(this);
        this.onDragEnd = this.onDragEnd.bind(this);
        this.onResizeMove = this.onResizeMove.bind(this);
        this.onResizeEnd = this.onResizeEnd.bind(this);
    }

    /** keyboard actions for the popup */
    key_actions = [];

    /** Overridden aurelia lifecycle method */
    attached() {
        let key_actions = [];
        for (let i = 0; i <= 9; i++) {
            key_actions.push({ key: i.toString(), func: this.handleKeyAction, ctrl: false});
        }
        this.key_actions = key_actions;

        Ui.registerKeyHandlers(this.context, key_actions, TABS.ROIS, this);
    }

    /** called when the view and its elemetns are detached */
    detached() {
        this.key_actions.map(
            (action) => this.context.removeKeyListener(action.key, TABS.ROIS));
    }

    bind() {
        this.subscribe();
    }

    unbind() {
        this.unsubscribe();
        this.onDragEnd();
        this.onResizeEnd();
    }

    show() {
        this.visible = true;
        this.loadTags();
        this.loadExperimenters();
    }

    /**
     * Handle keys 0-9 only - added in attached() above
     * @param {{key: string}} args 
     */
    handleKeyAction(args) {
        if (!this.visible) {
            return false;
        }
        let index = parseInt(args.key, 10) - 1;
        if (index < 0) {
            index = 9;
        }
        if (index >= this.selected_tags.length) {
            return false;
        }
        this.linkTag(this.selected_tags[index]);
        return false;
    }

    loadTags() {
        this.tags_loaded = false;
        sendRequest({
            server: this.context.server,
            uri: this.context.getPrefixedURI(WEBCLIENT) +
                '/api/tags/?orphaned=true&experimenter_id=-1&limit=1000&group=' + this.group_id,
            method: 'GET',
            success: (rsp) => {
                let json = typeof rsp === 'string' ? JSON.parse(rsp) : rsp;
                this.tags = this.parseTags(json);
                this.tags_loaded = true;
                this.restoreSelectedTags();
            },
            error: () => {
                this.tags = [];
                this.tags_loaded = true;
                this.restoreSelectedTags();
            }
        });
    }

    loadExperimenters() {
        sendRequest({
            server: this.context.server,
            uri: this.context.getPrefixedURI(WEB_API_BASE) + '/m/experimenters/?experimentergroup=' + this.group_id,
            method: 'GET',
            success: (rsp) => {
                let json = typeof rsp === 'string' ? JSON.parse(rsp) : rsp;
                this.experimenters = (json.data || []).map(e => ({
                    id: e['@id'],
                    FirstName: e['FirstName'],
                    LastName: e['LastName']
                })).sort((a, b) => a.LastName.localeCompare(b.LastName));
            },
            error: () => {
                this.experimenters = [];
            }
        });
    }

    parseTags(json) {
        return (json.tags || []).map(
            (t) => ({
                id: t['id'],
                value: t['value'],
                tagset: t['set'],
                expanded: false,
                ownerId: t['ownerId'],
                children: []
            })).sort((a, b) => {
                // tagset should come before individual tags
                if (a.tagset && !b.tagset) return -1;
                if (!a.tagset && b.tagset) return 1;
                return a.value.localeCompare(b.value);
            });
    }

    /**
     * Expands/collapses a tagset, loading its child tags on first expansion
     * @param {Object} tagset the tagset
     */
    toggleTagset(tagset, callback) {
        tagset.expanded = !tagset.expanded;
        if (!tagset.expanded || tagset.children_loaded) return;
        sendRequest({
            server: this.context.server,
            uri: this.context.getPrefixedURI(WEBCLIENT) +
                '/api/tags/?id=' + tagset.id,
            method: 'GET',
            success: (rsp) => {
                let json = typeof rsp === 'string' ? JSON.parse(rsp) : rsp;
                tagset.children = this.parseTags(json);
                tagset.children_loaded = true;
                if (callback) callback();
            },
            error: () => {
                tagset.children = [];
                if (callback) callback();
            }
        });
    }

    /**
     * @param {{id: number, value: string}} tag the double-clicked tag
     */
    linkTag(tag) {
        // We don't link tagsets, only individual tags
        if (tag.tagset) return;
        // ignore accidental double-clicks - if the tag is already highlighted
        if (this.highlighted_tagId === tag.id) return;
        this.context.publish(LINK_TAG, {tag_id: tag.id});
        this.highlighted_tagId = tag.id;
        setTimeout(() => {
            this.highlighted_tagId = null;
        }, 1000);
    }

    /**
     * Switches between the 'all' and 'selected' tabs
     * @param {string} tab the tab to switch to
     */
    selectTab(tab) {
        this.active_tab = tab;
    }

    /**
     * The tags list filtered by the text typed into the "All Tags" filter
     * input (case-insensitive substring match on the tag's value) and/or
     * the owner selected in the "All Tags" owner filter
     * @return {Array.<Object>} the filtered tags
     */
    @computedFrom('tags', 'tags_filter', 'tags_owner')
    get filtered_tags() {
        let filter = (this.tags_filter || '').trim().toLowerCase();
        let owner = this.tags_owner;
        return this.tags.filter((tag) => {
            if (owner !== null && tag.ownerId !== owner) return false;
            if (filter !== '' && !tag.value.toLowerCase().includes(filter)) {
                return false;
            }
            return true;
        });
    }

    /**
     * Adds a tag to the selected_tags list (if not already present)
     * @param {{id: number, value: string}} tag the tag to select
     */
    selectTag(tag) {
        // If a tagset is passed, we instead select all child tags
        if (tag.tagset) {
            let addChildren = (children) => {
                children.forEach((child) => {
                    if (!this.selected_tags.some((t) => t.id === child.id)) {
                        this.selected_tags.push(child);
                    }
                });
                this.saveSelectedTags();
            };
            // If children are not loaded yet, they should be loaded first
            if (!tag.children_loaded) {
                this.toggleTagset(tag, () => {
                    addChildren(tag.children);
                });
            } else {
                addChildren(tag.children);
            }
        } else {
            if (this.selected_tags.some((t) => t.id === tag.id)) return;
            this.selected_tags.push(tag);
            this.saveSelectedTags();
        }
        this.highlighted_tab = 'selected';
        setTimeout(() => {
            this.highlighted_tab = null;
        }, 1000);
    }

    /**
     * Removes a tag from the selected_tags list
     * @param {{id: number, value: string}} tag the tag to deselect
     */
    deselectTag(tag) {
        if (!tag) return;
        this.selected_tags = this.selected_tags.filter((t) => t.id !== tag.id);
        this.saveSelectedTags();
    }

    /** index of the selected_tags entry currently being dragged (or null) */
    dragTagIndex = null;

    /** index of the selected_tags entry currently being dragged over (or null) */
    dragOverIndex = null;

    /**
     * Starts dragging a row in the Selected Tags list for reordering
     * @param {DragEvent} event
     * @param {number} index the index of the row in selected_tags
     */
    onTagDragStart(event, index) {
        this.dragTagIndex = index;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            // Firefox requires data to be set for the drag to start
            try {
                event.dataTransfer.setData('text/plain', String(index));
            } catch (e) {
                // ignore, not all browsers allow this
            }
        }
        // IMPORTANT: Aurelia's ".trigger" binding command calls
        // event.preventDefault() on the bound event unless the handler
        // explicitly returns true (see aurelia-binding Listener.callSource).
        // Calling preventDefault() on "dragstart" cancels the native drag
        // operation entirely, so this handler (and the other drag handlers
        // below) must return true to opt out of that behaviour.
        return true;
    }

    /**
     * Called continuously while dragging over a row, used to show
     * an insertion indicator and allow dropping
     * @param {DragEvent} event
     * @param {number} index the index of the row being dragged over
     */
    onTagDragOver(event, index) {
        if (this.dragTagIndex === null) return true;
        // preventDefault() on dragover is required to allow a drop here
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        this.dragOverIndex = index;
        return true;
    }

    /**
     * Drops the dragged row onto the given index, moving it within
     * the selected_tags array and persisting the new order
     * @param {DragEvent} event
     * @param {number} index the index to drop the dragged row onto
     */
    onTagDrop(event, index) {
        console.log("onTagDrop", { from: this.dragTagIndex, to: index });
        event.preventDefault();
        if (index === -1) {
            // dragged over the last placeholder, hard-coded as "-1" in the HTML
            index = this.selected_tags.length;
        }
        const from = this.dragTagIndex;
        if (from === null || from === index) {
            this.onTagDragEnd();
            return true;
        }
        if (index > from) {
            // if we remove an item from a lower index, the target index shifts down by 1
            index = index - 1;
        }
        const tags = this.selected_tags.slice();
        const [moved] = tags.splice(from, 1);
        tags.splice(index, 0, moved);
        this.selected_tags = tags;
        this.saveSelectedTags();
        this.onTagDragEnd();
        return true;
    }

    /** Resets drag state, called on drop or when a drag is cancelled */
    onTagDragEnd() {
        this.dragTagIndex = null;
        this.dragOverIndex = null;
        return true;
    }

    /**
     * Persists the ids of the selected_tags (in order) to localStorage
     */
    saveSelectedTags() {
        try {
            localStorage.setItem(
                SELECTED_TAGS_STORAGE_KEY,
                JSON.stringify(this.selected_tags.map((t) => t.id)));
        } catch (e) {
            // localStorage may be unavailable/full, nothing we can do
        }
    }

    /**
     * Restores the selected_tags list from the ids previously stored in
     * localStorage, preserving their order and matching them against the
     * currently loaded tags
     */
    restoreSelectedTags() {
        let ids = [];
        try {
            ids = JSON.parse(localStorage.getItem(SELECTED_TAGS_STORAGE_KEY)) || [];
        } catch (e) {
            ids = [];
        }
        if (!Array.isArray(ids) || ids.length === 0) {
            this.selected_tags = [];
            return;
        }
        // Use the loaded tags to reconstruct the selected_tags list from IDs
        let selected_tags = ids.map((id) => this.tags.find((t) => t.id === id));

        // If any of the selected tags are undefined (e.g. from in a Tagset that hasn't been loaded), we need to fetch ALL tags from the server
        if (selected_tags.some((t) => typeof t === 'undefined')) {
            sendRequest({
                server: this.context.server,
                uri: this.context.getPrefixedURI(WEBCLIENT) + '/api/tags/?experimenter_id=-1&limit=1000&group=' + this.group_id,
                method: 'GET',
                success: (rsp) => {
                    let json = typeof rsp === 'string' ? JSON.parse(rsp) : rsp;
                    let allTags = this.parseTags(json);
                    selected_tags = ids.map((id) => allTags.find((t) => t.id === id)).filter((t) => typeof t !== 'undefined');
                    this.selected_tags = selected_tags;
                },
                error: () => {
                    console.error('Failed to fetch all tags from the server');
                }
            });
        } else {
            // All tags were found
            this.selected_tags = selected_tags;
        }
    }

    hide() {
        this.visible = false;
    }

    /**
     * Starts dragging when the title bar is pressed
     * @param {MouseEvent} event
     */
    onDragStart(event) {
        if (event.button !== 0) return true;
        this.dragOffsetX = (window.innerWidth - this.right) - event.clientX;
        this.dragOffsetY = event.clientY - this.top;
        document.addEventListener('mousemove', this.onDragMove);
        document.addEventListener('mouseup', this.onDragEnd);
        event.preventDefault();
        return false;
    }

    onDragMove(event) {
        const maxRight = Math.max(0, window.innerWidth - this.width - 30);
        const maxTop = Math.max(0, window.innerHeight - 30);
        this.right = Math.min(Math.max(0, window.innerWidth - (event.clientX + this.dragOffsetX)), maxRight);
        this.top = Math.min(Math.max(40, event.clientY - this.dragOffsetY), maxTop);
    }

    onDragEnd() {
        document.removeEventListener('mousemove', this.onDragMove);
        document.removeEventListener('mouseup', this.onDragEnd);
    }

    /**
     * Starts resizing when the bottom-left corner handle is pressed.
     * The popup is anchored via its "right"/"top" css properties, so
     * resizing from the bottom-left corner grows the width leftwards
     * and the height downwards, leaving those anchors unchanged.
     * @param {MouseEvent} event
     */
    onResizeStart(event) {
        if (event.button !== 0) return true;
        this.resizeStartX = event.clientX;
        this.resizeStartY = event.clientY;
        this.resizeStartWidth = this.width;
        this.resizeStartHeight = this.height;
        document.addEventListener('mousemove', this.onResizeMove);
        document.addEventListener('mouseup', this.onResizeEnd);
        event.stopPropagation();
        event.preventDefault();
        return false;
    }

    onResizeMove(event) {
        const minWidth = 200;
        const maxWidth = Math.max(minWidth, window.innerWidth - this.right - 20);
        const minListHeight = 80;
        const maxListHeight = Math.max(minListHeight, window.innerHeight - this.top - 120);

        const newWidth = this.resizeStartWidth + (this.resizeStartX - event.clientX);
        const newHeight = this.resizeStartHeight + (event.clientY - this.resizeStartY);

        this.width = Math.min(Math.max(minWidth, newWidth), maxWidth);
        this.height = Math.min(Math.max(minListHeight, newHeight), maxListHeight);
    }

    onResizeEnd() {
        document.removeEventListener('mousemove', this.onResizeMove);
        document.removeEventListener('mouseup', this.onResizeEnd);
    }
}
