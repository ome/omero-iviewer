import {noView} from 'aurelia-framework';
import Misc from '../utils/misc';
import ImageInfo from '../model/image_info';
import {
    IMAGE_SETTINGS_CHANGE, IMAGE_DIMENSION_CHANGE, EventSubscriber
} from '../events/events';
import * as d3 from 'd3';

/**
 * Histogram Functionality (no view, just code)
 */
@noView
export default class Histogram extends EventSubscriber {

    /**
     * an image_info reference
     * @memberof Histogram
     * @type {ImageInfo}
     */
    image_info = null;

    /**
     * a flag that can be used to disable the histogram Functionality
     * useful if backend request is not implemented or
     * constructor args are missing, just to list 2 examples
     * @memberof Histogram
     * @type {boolean}
     */
    enabled = false;

    /**
     * a flag that prevents plotting when the histogram is not visible
     * i.e. checkbox is unchecked
     * @memberof Histogram
     * @type {boolean}
     */
    visible = false;

    /**
     * we piggyback onto image settings and dimensions changes
     * to get notified for channel property and dimension changes
     * that result in histogram/line plotting
     * @memberof Histogram
     * @type {Array.<string,function>}
     */
    sub_list = [[IMAGE_SETTINGS_CHANGE,
                    (params={}) => {
                        if (typeof params.prop !== 'string' ||
                            params.prop === 'active' ||
                            params.prop === 'color')
                            this.plotHistogram();
                        else this.plotHistogramLines();
                    }],
                [IMAGE_DIMENSION_CHANGE,
                    (params={}) => this.plotHistogram()]
    ];

    /**
     * the graph width/height
     * @memberof Histogram
     * @type {Array.<number>}
     */
    graph_dims = [256, 150];

    /**
     * data column number
     * @memberof Histogram
     * @type {Array.<number>}
     */
    graph_cols = 256;

    /**
     * the graph's svg element
     * @memberof Histogram
     * @type {SVGElement}
     */
    graph_svg = null;

    /**
     * last active channel which we have to remember because the event doesn't
     * contain that info. it might be that toggling active affected unrelevant
     * channels such as after the first active...
     * @memberof Histogram
     * @type {Array.<number>}
     */
    last_active_channel = null;

    /**
     * @constructor
     * @param {ImageInfo} image_info a reference to the image info
     * @param {string} selector selector for the element that holds the histogram
     */
    constructor(image_info=null, selector=".histogram") {
        super(image_info ? image_info.context.eventbus : null);
        // elementary check for image info existence and selector validity
        if (!(image_info instanceof ImageInfo) || $(selector).length === 0)
            return;
        // set members
        this.image_info = image_info;
        this.selector = selector;
        //subscribe to events that tell us whenever and what we need to re-plot
        this.subscribe();
        // we fire off a first request to check if backend supports histograms
        this.requestHistogramJson(0, ((data) => {
                this.enabled = (data !== null);
                if (this.enabled) this.createHistogramSVG(data);
            }));
    }

    /**
     * Creates the histogram
     * @param {Array} data the data (from the initial request)
     * @memberof Histogram
     */
    createHistogramSVG(data = null) {
        if (!this.enabled) return;

        // 1px margin to right so slider marker not lost
        this.graph_svg = d3.select($(this.selector).get(0)).append("svg")
              .attr("width", this.graph_dims[0] + 1)
              .attr("height", this.graph_dims[1])
              .append("g");

          // line plot
          this.graph_svg.append("g")
              .append("path")
              .attr("class", "histogram-line");

          // area fill
          this.graph_svg.append("path")
              .attr("class", "histogram-area")
              .attr('opacity', 0.5);

          // Add slider markers
          this.graph_svg.selectAll("rect")
              .data([0, 0])
              .enter().append("rect")
              .attr("y", 0)
              .attr("height", 300)
              .attr("width", 1)
              .attr("x", (d, i) => d * (this.graph_dims[1]/2));

         // plot histogram
         if (data) this.plotHistogram(data);
    }

    /**
     * @return the index first active channel or 0 otherwise
     * @memberof Histogram
     */
    getFirstActiveChannel() {
        if (!this.enabled || !Misc.isArray(this.image_info.channels)) return 0;

        if (Misc.isArray(this.image_info.channels))
            for (let i in this.image_info.channels)
                if (this.image_info.channels[i].active) return parseInt(i);

        return 0;
    }

    /**
     * Plots the histogram
     * @param {Array} data
     * @memberof Histogram
     */
    plotHistogram(data) {
        // we don't plot if we are not enabled or visible
        if (!this.enabled || !this.visible) return;

        // find first active channel
        let channel = this.getFirstActiveChannel();
        // there are cases where the channels active flag was toggled
        // but we don't care because the first active one is still the same
        if (channel === this.last_active_channel) return;
        this.last_active_channel = channel; // set new first active channel

        if (typeof this.image_info.channels[channel] !== 'object') return;
        let color = "#" + this.image_info.channels[channel].color;
        if (color === "#FFFFFF") color = "#000000";

        // handler after successful backend data fetch
        let plotHandler = (data) => {
            // cache this for use by chartRange
            this.graph_cols = data.length;

            let x = d3.scaleLinear()
                .domain([0, data.length - 1])
                .range([0, this.graph_dims[0]]);

            let y = d3.scaleLinear()
                .domain([
                    d3.min(data),
                    d3.max(data)])
                .range([this.graph_dims[1], 0]);

            // line
            let line = d3.line()
                .x((d, i) => x(i))
                .y((d, i) => y(d));
            this.graph_svg.selectAll(".histogram-line")
                .datum(data)
                .attr("d", line)
                .attr('stroke', color);

            // area to fill under line
            let area = d3.area()
                .x((d, i) => x(i))
                .y0(this.graph_dims[1])
                .y1((d)=> y(d));
            this.graph_svg.selectAll(".histogram-area")
                .datum(data)
                .attr("class", "histogram-area")
                .attr("d", area)
                .attr('fill', color);

            // plot lines
            this.plotHistogramLines(channel);
        };

        // if we got data already (in the case of the initial request) => use it
        // otherwise issue the ajax request
        if (Misc.isArray(data)) plotHandler(data);
        else this.requestHistogramJson(channel, plotHandler);
    }

    /**
     * Plots the lines only
     * @param {number} activeChannel the active channel index(if called from plotHistogram)
     * @memberof Histogram
     */
    plotHistogramLines(activeChannel = null) {
        // we don't plot if we are not enabled or visible
        if (!this.enabled || !this.visible) return;

        // find first active channel if we weren't given one
        let channel =
            (typeof this.image_info.channels[activeChannel] === 'object' &&
                this.image_info.channels[activeChannel]) ?
                    activeChannel : this.getFirstActiveChannel();
        if (typeof this.image_info.channels[channel] !== 'object') return;

        let c = this.image_info.channels[channel];
        let color = "#" + c.color;
        if (color === "#FFFFFF") color = "#000000";
        let delta = c.window.max - c.window.min;
        let s = ((c.window.start - c.window.min) / delta) * this.graph_cols;
        let e = ((c.window.end - c.window.min) / delta) * this.graph_cols;

        this.graph_svg.selectAll("rect")
            .data([s, e])
            .attr("x", (d, i) => d * (this.graph_dims[0]/this.graph_cols))
            .attr('fill', color);
    }

    /**
     * Toggles Visibility
     * @memberof Histogram
     */
    toggleHistogramVisibilty(visible = false) {
        if (!this.enabled || typeof visible !== 'boolean') return;

        if (visible) {
            // if we were invisible => plot again with present settings
            if (!this.visible) {
                this.visible = true;
                this.plotHistogram();
            }
            $(this.selector).show();
        }
        else {
            $(this.selector).hide();
            this.visible = false;
        }
    }

    /**
     * Requests Histogram Data
     * @param {number} channel the channel
     * @param {function} handler the success handler
     * @memberof Histogram
     */
    requestHistogramJson(channel = 0,handler = null) {
        // some bounds and existence checks
        // (unless for the initial request - no asyc image data present yet)
        if (Misc.isArray(this.image_info.channels) &&
                (typeof channel !== 'number' || channel < 0 ||
                channel > this.image_info.channels.length ||
                typeof handler !== 'function')) return;

        // assemble url
        let server = this.image_info.context.server;
        let time = this.image_info.dimensions.t;
        let plane = this.image_info.dimensions.z;
        let url = server + "/webgateway/histogram_json/" +
            this.image_info.image_id + "/channel/" + channel + "/?theT=" +
            time + "&theZ="+ plane;

        // fire off ajax request
        $.ajax({url : url,
            dataType : Misc.useJsonp(server) ? 'jsonp' : 'json',
            cache : false,
            success : (response) => {
                // for error and non array data (which is what we want)
                // we return null and the handler will respond accordingly
                if (!Misc.isArray(response)) response =null;
                handler(response);
            },
            error : () => handler(null)});
    }

    destroyHistogram() {
        this.unsubscribe();
        this.image_info = null;
    }
}
