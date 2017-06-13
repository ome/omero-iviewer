#
# Copyright (c) 2017 University of Dundee.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#


def get_version(version=None):

    """
    Returns a PEP 386-compliant version number.
    See https://www.python.org/dev/peps/pep-0440/
    """

    version = get_full_version(version)
    parts = 3
    res = '.'.join(str(x) for x in version[:parts])
    if len(version) > 3:
        res = "%s%s" % (res, version[3])
    return str(res)


def get_full_version(value=None):

    """
    Returns a tuple of the iviewer version.
    """

    if value is None:
        from version import VERSION as value  # noqa
    return value
