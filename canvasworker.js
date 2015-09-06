var CanvasWorker = (function(L) {
	"use strict";

	/**
	 *
	 * @param {[String]|[HTMLElement]} urlsOrElements
	 * @param {Object} [settings]
	 * @constructor
	 */
	function CanvasWorker(urlsOrElements, settings) {
		this.setDefaults(settings || {});

		var s = this.settings,
			el = s.element,
			container = this.container = document.createElement('div'),
			style = container.style;

		if (el) {
			style.overflow = 'hidden';
			style.position = 'absolute';
			style.width = (s.width = el.clientWidth) + 'px';
			style.height = (s.height = el.clientHeight) + 'px';

			el.appendChild(container);
		}

		this.urlsOrElements = urlsOrElements;
		this.images = [];
		this.raw = [];
		this.tiles = [];

		this
			.buildTiles()
			.loadAllImages();
	}

	CanvasWorker.prototype = {
		/**
		 *
		 * @param {Object} settings
		 * @returns {CanvasWorker}
		 */
		setDefaults: function(settings) {
			var defs = CanvasWorker.defaultSettings,
				prop;

			for(prop in defs) if (defs.hasOwnProperty(prop) && prop) {
				settings[prop] = settings[prop] !== undefined ? settings[prop] : defs[prop];
			}

			this.settings = settings;

			return this;
		},

		/**
		 *
		 * @returns {CanvasWorker}
		 */
		toRaw: function() {
		    var i = 0,
				images = this.images,
				max = images.length,
				img,
				canvas,
				context,
                res = unsprite.res(),
                ratio = res > 1 ? 2 : 1,
                w,
                h;

			for (;i < max; i++) {
				img = images[i];
				canvas = document.createElement("canvas");

				//resize if needed
                w = canvas.width = img.width / ratio,
				h = canvas.height = img.height / ratio;

				context = canvas.getContext('2d');
				context.clearRect(0, 0, w, h);

                //rescale if needed
                if (res > 1) {
                    context.scale(0.5, 0.5);
                }

				context.drawImage(img, 0, 0);

				if (w > 0 && h > 0) {
				    this.raw[i] = context.getImageData(0, 0, w, h);
				}
			}

			return this;
		},

		/**
		 *
		 * @returns {CanvasWorker}
		 */
		loadAllImages: function() {
			var i = 0,
				me = this,
				urlsOrElements = this.urlsOrElements,
				max = urlsOrElements.length,
				finished = 0;

			for (;i < max; i++) {
				(function (i, urlOrElement) {
				    var url,
                        element;

					if (typeof urlOrElement === 'string') {
						url = urlOrElement;

						me.load(url, function (element) {
							me.images[i] = element;
							finished++;
							if (finished === max) {
								me
									.toRaw()
									.render(me.settings.drawFinished);
							}
						});
					} else {
						element = urlOrElement;
						me.images[i] = element;
						finished++;
						if (finished === max) {
							me
								.toRaw()
								.render(me.settings.drawFinished);
						}
					}
				})(i, urlsOrElements[i]);
			}

			return this;
		},

		/**
		 *
		 * @param {String} url
		 * @param {Function} [callback]
		 * @returns {CanvasWorker}
		 */
		load: function(url, callback) {
			var img = new Image(),
				me = this;
			img.onload = function() {
				if (callback) callback.call(me, img);
			};
			img.src = url;

			return this;
		},

		/**
		 *
		 * @returns {CanvasWorker}
		 */
		buildTiles: function() {
			var s = this.settings,
				w = s.tileWidth,
				h = s.tileHeight,
				columnMax = s.width / w,
				rowMax = s.height / h,
				columnIndex,
				rowIndex = 0,
				tiles = this.tiles,
				tile,
				style;

			for (; rowIndex <= rowMax; rowIndex++) {
				for (columnIndex = 0; columnIndex <= columnMax; columnIndex++) {
					tile = document.createElement('canvas');

					tile.left = w * columnIndex;
					tile.right = (w * columnIndex) + w;
					tile.top = h * rowIndex;
					tile.bottom = (h * rowIndex) + h;
					tile.tileIndex = tiles.length;

					tile.width = w;
					tile.height = h;
					tile.compose = [];

					tile.setAttribute('left', (w * columnIndex).toString());
					tile.setAttribute('right', ((w * columnIndex) + w).toString());
					tile.setAttribute('top', (h * rowIndex).toString());
					tile.setAttribute('bottom', ((h * rowIndex) + h).toString());
					tile.setAttribute('data-index', tiles.length.toString());

					style = tile.style;
                    style['opacity'] = 0.01;
                    style['transition'] = 'opacity .25s ease-in-out';
                    style['-moz-transition'] = 'opacity .25s ease-in-out';
                    style['-webkit-transition'] = 'opacity .25s ease-in-out';
					style.position = 'absolute';
					style.left = (w * columnIndex) + 'px';
					style.top = (h * rowIndex) + 'px';
					tiles.push(tile);
				}
			}

			return this;
		},

		/**
		 *
		 * @returns {CanvasWorker}
		 */
		groupComposeToTiles: function() {
			var s = this.settings,
				compose = s.compose,
				composeMax = compose.length,
				tiles = this.tiles,
				tileMax = tiles.length,
				tileIndex = 0,
				sorted = 0,
				cIndex,
                image,
				tile,
				w,
				h,
				c;


			for (cIndex = 0; cIndex < composeMax; cIndex++) {
			    c = compose[cIndex];
			    image = this.raw[c.image];
			    if (image === undefined) continue;
				w = image.width;
				h = image.height;
				for (tileIndex = 0; tileIndex < tileMax; tileIndex++) {
					tile = tiles[tileIndex];

					//if inside tile
					if (
						c.x > tile.left - w
						&& c.x < tile.right + w
						&& c.y > tile.top - h
						&& c.y < tile.bottom + h
					) {
						tile.compose.push(c);
						sorted++;
					}
				}
			}

			if (sorted < compose.length) {
				//throw new Error('Missed by: ' + (compose.length - sorted));
			}
			return this;

		},

		/**
		 *
		 * @param callback
		 * @returns {CanvasWorker}
		 */
		render: function(callback) {

			this.groupComposeToTiles();

			var container = this.container,
				tiles = this.tiles,
				max = tiles.length,
				success = 0,
				me = this,
				i = 0;

			for (;i< max;i++) {
				(function(canvas) {
				    var thread = me.thread(),
						context = canvas.getContext('2d'),
                        compose = canvas.compose,
						rawCanvas,
						doDraw,
                        bounds,
                        ne,
						sw;

				    if (L !== undefined) {
				        ne = map.containerPointToLatLng(L.point(canvas.left + canvas.width, canvas.top));
				        sw = map.containerPointToLatLng(L.point(canvas.left, canvas.top + canvas.height));
				        bounds = L.latLngBounds(sw, ne);
				    }

					context.clearRect(0, 0, canvas.width, canvas.height);

					rawCanvas = context.getImageData(0, 0, canvas.width, canvas.height);

					thread.drawEach(compose, me.raw, rawCanvas, canvas.left, canvas.top, function (merged) {
						canvas.style.transition = 'opacity 1s';
						canvas.style['-webkit-transition'] = 'opacity 1s';
						canvas.style.opacity = '0.01';
						context.putImageData(merged, 0, 0);
						container.appendChild(canvas);
						success++;

						canvas.addTo = function(map) {
						    var dataUrl = canvas.toDataURL();
						    return L.imageOverlay(dataUrl, bounds)
                                .addTo(map);
						};

						if (success === max) {
							doDraw = callback(canvas, context, true);
						} else {
							doDraw = callback(canvas, context, false);
						}

						setTimeout(function () {
							canvas.style.opacity = '1';
						}, 0);
					});
				})(tiles[i]);
			}

			return this;
		},

		/**
		 *
		 * @returns {operative|Object}
		 */
		thread: function() {
            if (this.settings.threadCount === 0) return CanvasWorker.threadScope;

			var activeThread,
				i = CanvasWorker.threadIndex;

			if (i >= this.settings.threadCount) i = CanvasWorker.threadIndex = 0;

			if (CanvasWorker.activeThreads[i] === undefined) {
                CanvasWorker.activeThreads[i] = operative(CanvasWorker.threadScope);
			}

			activeThread = CanvasWorker.activeThreads[i];

            CanvasWorker.threadIndex++;

			return activeThread;
		}
	};

	CanvasWorker.defaultSettings = {
		/**
		 * @type {Function}
		 */
		drawFinished: function() {},

		/**
		 * @type {Number}
		 */
		tileWidth: 256,

		/**
		 * @type {Number}
		 */
		tileHeight: 256,

		/**
		 * @type {Number} used if no element is specified
		 */
		width: 0,

		/**
		 * @type {Number} used if no element is specified
		 */
		height: 0,

		/**
		 * @type {[Object]}
		 */
		compose: null,

		/**
		 * @type {HTMLElement}
		 */
		element: null,

        /**
         * @type {Number}
         */
		threadCount: 8,

	    /**
         * @type {Boolean}
         */
        retina: false
	};

	/**
	 * @namespace
	 * @type {Object}
	 */
	CanvasWorker.threadScope = {

		/**
		 *
		 * @param {[Object]} compose
		 * @param {[ImageData]} rawImages
		 * @param {ImageData} rawCanvas
		 * @param {Number} tileX
		 * @param {Number} tileY
		 * @param {Function} [callback]
		 */
		drawEach: function(compose, rawImages, rawCanvas, tileX, tileY, callback) {
			var i = 0,
				max = compose.length,
				c;

			for (;i < max; i++) {
				c = compose[i];
				rawCanvas = this.draw(rawCanvas, rawImages[c.image], c.x - tileX, c.y - tileY);
			}

			if (callback) callback(rawCanvas);
		},

		/**
		 *
		 * @param {ImageData} rawCanvas
		 * @param {ImageData} rawImage
		 * @param {Number} x
		 * @param {Number} y
		 * @returns {ImageData}
		 */
		draw: function( rawCanvas, rawImage, x, y ) {
			x = x >> 0;
			y = y >> 0;

			if (x === undefined) return rawCanvas;
			if (y === undefined) return rawCanvas;

			/**
			 * Lookup x & y from index
			 * y = (i / 4) % width
			 * x = Math.floor((i / 4) / width)
			 *
			 * Lookup index from x & y
			 * i = (y * width + x) * 4
			 */
			var newCanvasData = rawCanvas.data,
				imageData = rawImage.data,

				//set starting point
				i = 0,
				canvasX,
				canvasY,
				max = imageData.length,
				imageX = 0,
				imageY = 0,
				canvasIndex,
                norm = 1 / 255,

                //rgbn from image (there)
                _r,
                _g,
                _b,
                _n,

                //rgbn from canvas (here)
                r_,
                g_,
                b_,
                n_;

			for (;i < max;) { // iterate through image bytes
				imageX = (i / 4) % rawImage.width;
				imageY = Math.floor((i / 4) / rawImage.width);
				canvasX = imageX + x;
				canvasY = imageY + y;
				canvasIndex = (canvasY * rawCanvas.width + canvasX) * 4;

				if (canvasX < 0 || canvasX >= rawCanvas.width) {
					i+=4;
					continue;
				}

                _r = imageData[i++];
                _g = imageData[i++];
                _b = imageData[i++];
                _n = imageData[i++];

                r_ = newCanvasData[canvasIndex];
                g_ = newCanvasData[canvasIndex+1];
                b_ = newCanvasData[canvasIndex+2];
                n_ = newCanvasData[canvasIndex+3];

                n_ += _n;
                n_ = Math.min(n_, 255);

                //first off, if _n (foreground opacity) is 255, that means it superceedes everything else
                if (_n === 255) {
                    r_ = _r;
                    g_ = _g;
                    b_ = _b;
                }

                //else if foreground is more than 0, then it needs to be blended
                //outputRed = (foregroundRed * foregroundAlpha) + (backgroundRed * (1.0 - foregroundAlpha));
                else if (_n > 0) {
                    r_ = (_r * _n * norm) + (r_ * (1 - (_n * norm)));
                    b_ = (_b * _n * norm) + (b_ * (1 - (_n * norm)));
                    g_ = (_g * _n * norm) + (g_ * (1 - (_n * norm)));
                }

                //if all else fails
                else {
                    r_ = Math.min(r_ + _r, 255);
                    g_ = Math.min(g_ + _g, 255);
                    b_ = Math.min(b_ + _b, 255);
                }

                newCanvasData[canvasIndex++] = r_;
                newCanvasData[canvasIndex++] = g_;
                newCanvasData[canvasIndex++] = b_;
                newCanvasData[canvasIndex++] = n_;
			}

			return rawCanvas;
		}
	};

    CanvasWorker.activeThreads = {};
    CanvasWorker.threadIndex = 0;

	return CanvasWorker;
})(L);