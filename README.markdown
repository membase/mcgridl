mcgridl
=======

mcgridl -- a load-generator and web UI for memcached/membase

Building
--------

To enjoy your own mcgridl...

Get node.js.  On the Mac, if you use homebrew...

* brew install node

Then...

* git clone git@github.com:northscale/mcgridl.git

Running
-------

* start a memcached/membase server, listening on localhost 11211

* node gridl.js -s 127.0.0.1

* point your web browser to http://127.0.0.1:8888 to see the mcgridl UI.

More Stuff
----------

Other things you can do...

For membase, you can hit more servers in your cluster with mcgridl...

* node gridl.js -s 127.0.0.1 -s mcserver2 -s mcserver3

Get more help...

* node gridl.js --help

License
-------

Apache - this was made for you.

