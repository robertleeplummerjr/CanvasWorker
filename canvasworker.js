var CanvasWorker = (function() {
	"use strict";

	function CanvasWorker(urls, settings) {
		this.setDefaults(settings);

		var el = this.settings.element,
			container = this.container = document.createElement('div'),
			style = container.style;

		style.overflow = 'hidden';
		style.position = 'absolute';
		style.width = el.clientWidth + 'px';
		style.height = el.clientHeight + 'px';

		el.appendChild(container);

		this.urls = urls;
		this.urlData = {};
		this.images = [];
		this.raw = [];

		this.buildTiles();
		this.loadAllImages();
	}

	CanvasWorker.prototype = {
		setDefaults: function(settings) {
			var defs = CanvasWorker.defaultSettings,
				prop;

			for(prop in defs) if (defs.hasOwnProperty(prop) && prop) {
				settings[prop] = settings[prop] !== undefined ? settings[prop] : defs[prop];
			}

			this.settings = settings;

			return settings;
		},
		toRaw: function() {
			var i = 0,
				max = this.urls.length,
				img,
				canvas,
				context;

			for (;i < max; i++) {
				img = this.images[i];
				canvas = document.createElement("canvas");

				canvas.width = img.width;
				canvas.height = img.height;
				context = canvas.getContext('2d');
				context.clearRect(0, 0, img.width, img.height);
				context.drawImage(img, 0, 0);

				this.raw[i] = context.getImageData(0, 0, img.width, img.height);
			}

			return this;
		},
		loadAllImages: function() {
			var i = 0,
				me = this,
				urls = this.urls,
				max = urls.length,
				finished = 0;

			for (;i < max; i++) {
				(function(i, url) {
					me.load(url, function(result) {
						me.images[i] = result;
						finished++;
						if (finished === max) {
							me.toRaw();
							me.render(me.settings.drawFinished);
						}
					});
				})(i, urls[i]);
			}
		},
		load: function(url, callback) {
			var img = new Image(),
				me = this;
			img.onload = function() {
				me.urlData[url] = img;
				callback.call(me, img);
			};
			img.src = url;

			return this;
		},
		buildTiles: function() {
			var s = this.settings,
				el = this.container,
				w = s.tileSize.width,
				h = s.tileSize.height,
				columnMax = el.clientWidth / w,
				rowMax = el.clientHeight / h,
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

					tile.setAttribute('left', w * columnIndex);
					tile.setAttribute('right', (w * columnIndex) + w);
					tile.setAttribute('top', h * rowIndex);
					tile.setAttribute('bottom', (h * rowIndex) + h);
					tile.setAttribute('data-index', tiles.length);

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
		groupComposeToTiles: function() {
			var s = this.settings,
				compose = s.compose,
				composeMax = compose.length,
				tiles = this.tiles,
				tileMax = tiles.length,
				tileIndex = 0,
				sorted = 0,
				cIndex,
				tile,
				w,
				h,
				c;


			for (cIndex = 0; cIndex < composeMax; cIndex++) {
				c = compose[cIndex];
				w = this.raw[c.image].width;
				h = this.raw[c.image].height;
				for (tileIndex = 0; tileIndex < tileMax; tileIndex++) {
					tile = tiles[tileIndex];

					//if inside tile
					if (
						c.x > tile.left
						&& c.x < tile.right
						&& c.y > tile.top
						&& c.y < tile.bottom
					) {
						tile.compose.push(c);
						sorted++;
					}

					else if (
						(c.x + w) > tile.left
						&& (c.x + w) < tile.right
						&& (c.y + h) > tile.top
						&& (c.y + h) < tile.bottom
					) {
						tile.compose.push(c);
						sorted++;
					}
				}
			}

			if (sorted < compose.length) {
				throw new Error('Missed by: ' + (compose.length - sorted));
			}
			return this;

		},
		render: function(callback) {

			this.groupComposeToTiles();

			var s = this.settings,
				container = this.container,
				tiles = this.tiles,
				max = tiles.length,
				success = 0,
				me = this,
				i = 0;

			for (;i< max;i++) {
				(function(canvas) {

					var thread = me.thread(),
						context = canvas.getContext('2d'),
						rawCanvas,
						compose = canvas.compose;

					context.clearRect(0, 0, canvas.width, canvas.height);

					rawCanvas = context.getImageData(0, 0, canvas.width, canvas.height);

					thread.drawEach(compose, me.raw, rawCanvas, canvas.left, canvas.top, function (merged) {
						context.putImageData(merged, 0, 0);

						container.appendChild(canvas);

                        setTimeout(function() {
                            canvas.style.opacity = '1';
                        },0);

						success++;

						callback(false);

						if (success === max) {
							callback(true);
						}
					});
				})(tiles[i]);
			}

			return this;
		},
		tiles: [],

		/**
		 * @type {DocumentFragment}
		 */
		tileFragment: null,
		threadCount: 8,
		threadIndex: 0,
		activeThreads: {},
		thread: function() {
			var activeThread,
				i = this.threadIndex;

			if (i >= this.threadCount) i = this.threadIndex = 0;

			if (this.activeThreads[i] === undefined) {
				this.activeThreads[i] = operative(CanvasWorker.threadScope);
			}

			activeThread = this.activeThreads[i];

			this.threadIndex++;

			return activeThread;
		}
	};

	CanvasWorker.defaultSettings = {
		drawFinished: function() {},
		tileSize: {
			width: 256,
			height: 256
		},
		compose: null,
		element: null
	};

	CanvasWorker.threadScope = {
		drawEach: function(compose, rawImages, rawCanvas, tileX, tileY, callback) {
			var i = 0,
				max = compose.length,
				c;

			for (;i < max; i++) {
				c = compose[i];
				rawCanvas = this.draw(rawCanvas, rawImages[c.image], c.x - tileX, c.y - tileY);
			}

			callback(rawCanvas);
		},
		draw: function( rawCanvas, rawImage, x, y ) {
			x = x >> 0;
			y = y >> 0;

			if (x === undefined) return;
			if (y === undefined) return;

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
                _r,
                _g,
                _b,
                _n,
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

				/**
				 * debug script
				 * newCanvasData[i] = 200;
				 * newCanvasData[i + 1] = 200;
				 * newCanvasData[i + 2] = 200;
				 * newCanvasData[i + 3] = 200;*/

                _r = imageData[i++];
                _g = imageData[i++];
                _b = imageData[i++];
                _n = imageData[i++];

                r_ = newCanvasData[canvasIndex];
                g_ = newCanvasData[canvasIndex+1];
                b_ = newCanvasData[canvasIndex+2];
                n_ = newCanvasData[canvasIndex+3];

                //outputRed = (foregroundRed * foregroundAlpha) + (backgroundRed * (1.0 - foregroundAlpha));
                if (_n < 255) {
                    r_ = (_r * _n) + (r_ * (1.0));
                    g_ = (_g * _n) + (g_ * (1.0));
                    b_ = (_b * _n) + (b_ * (1.0));
                } else {
                    r_ = _r;
                    g_ = _g;
                    b_ = _b;
                }

                newCanvasData[canvasIndex++] = r_;
                newCanvasData[canvasIndex++] = g_;
                newCanvasData[canvasIndex++] = b_;
                newCanvasData[canvasIndex] += _n;
                newCanvasData[canvasIndex] = newCanvasData[canvasIndex] > 255 ? 255 : newCanvasData[canvasIndex];
                canvasIndex++;

                /*if (imageData[i] > 0) newCanvasData[canvasIndex++] = imageData[i];
                if (imageData[i + 1] > 0) newCanvasData[canvasIndex++] += imageData[i+1];
                if (imageData[i + 2] > 0) newCanvasData[canvasIndex++] += imageData[i+2];
                if (imageData[i + 3] > 0) newCanvasData[canvasIndex++] += imageData[i+3];
                i+=4;*/
			}

			return rawCanvas;
		}
	};

	return CanvasWorker;
})();