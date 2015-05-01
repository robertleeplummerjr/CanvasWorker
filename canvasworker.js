var CanvasWorker = (function() {
	"use strict";

	function split(a, n) {
		var len = a.length,out = [], i = 0;
		while (i < len) {
			var size = Math.ceil((len - i) / n--);
			out.push(a.slice(i, i += size));
		}
		return out;
	}

	function CanvasWorker(urls, settings) {
		this.setDefaults(settings);

		this.urls = urls;
		this.urlData = {};
		this.images = [];
		this.raw = [];

		this.buildMatrices();
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
		groupComposeToMatrices: function() {
			var s = this.settings,
				compose = s.compose,
				composeMax = compose.length,
				matrixIndex = 0,
				matrixMax = s.tiles,
				cIndex,
				sorted = 0,
				matrices = this.matrices,
				matrix,
				c;

			for (;matrixIndex < matrixMax; matrixIndex++) {
				matrix = matrices[matrixIndex];

				for (cIndex = 0; cIndex < composeMax; cIndex++) {
					c = compose[cIndex];

					//if inside outer
					if (
						c.x > matrix.leftOuter
						&& c.x < matrix.rightOuter
						&& c.y > matrix.topOuter
						&& c.y < matrix.bottomOuter
					) {
						//if outside inner
						if (
							c.x < matrix.leftInner
							|| c.x > matrix.rightInner
							|| c.y < matrix.topInner
							|| c.y > matrix.bottomInner
						) {
							matrix.compose.push(c);
							sorted++;
						}
					}
				}
			}

			if (sorted !== compose.length) {
				throw new Error('Missed by: ' + (compose.length - sorted));
			}
			return this;

		},
		render: function(callback) {

			this.groupComposeToMatrices();

			var s = this.settings,
				element = s.element,
				matrices = this.matrices,
				max = matrices.length,
				success = 0,
				me = this,
				i = 0;

			for (;i< max;i++) {
				(function(matrix) {

					var thread = me.thread(),
						canvas = document.createElement('canvas'),
						context = canvas.getContext('2d'),
						imageData,
						j = 0,
						compose = matrix.compose,
						maxJ = compose.length;

					for (;j < maxJ; j++) {
						thread.streamCompose(JSON.stringify(compose[j]));
					}

					canvas.width = element.clientWidth;
					canvas.height = element.clientHeight;
					context.clearRect(0, 0, canvas.width, canvas.height);
					canvas.style.position = 'absolute';
					imageData = context.getImageData(0, 0, canvas.width, canvas.height);

					thread.drawEach(me.raw, imageData, function (merged) {
						context.putImageData(merged, 0, 0);

						success++;

						element.appendChild(canvas);

						callback(false);

						if (success === max) {
							callback(true);
						}
					});
				})(matrices[i]);
			}

			return this;
		},
		buildMatrices: function() {
			var s = this.settings,
				element = s.element,
				center = {
					x: element.clientWidth / 2,
					y: element.clientHeight / 2
				},
				gap = {
					x: center.x / s.tiles,
					y: center.y / s.tiles
				},
				i = 1,
				matrix;

			for(;i <= s.tiles; i++) {
				matrix = {
					leftOuter: center.x - (gap.x * i),
					rightOuter: center.x + (gap.x * i),
					topOuter: center.y - (gap.y * i),
					bottomOuter: center.y + (gap.y * i),

					leftInner: i === 0 ? center.x : center.x - (gap.x * (i - 1)),
					rightInner: i === 0 ? center.x : center.x + (gap.x * (i - 1)),
					topInner: i === 0 ? center.y : center.y - (gap.y * (i - 1)),
					bottomInner: i === 0 ? center.y : center.y + (gap.y * (i - 1)),

					compose: []
				};
				this.matrices.push(matrix);
			}

			return this;
		},
		matrices: [],
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
		tiles: 8,
		compose: null,
		element: null
	};

	CanvasWorker.threadScope = {
		compose: [],
		streamCompose: function(c) {
			this.compose.push(JSON.parse(c));
		},
		drawEach: function(rawImages, rawCanvas, callback) {
			var i = 0,
				compose = this.compose,
				max = compose.length,
				c;

			for (;i < max; i++) {
				c = compose[i];
				rawCanvas = this.draw(rawCanvas, rawImages[c.image], c.x, c.y);
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
				i = (y * rawCanvas.width + x) * 4,
				newI,
				j = 0,
				canvasX,
				canvasY,
				maxI = ((y + rawImage.height) * rawCanvas.width + (x + rawImage.width)) * 4,
				maxJ = imageData.length,
				left = x,
				right = x + rawImage.width,
				top = y,
				bottom = y + rawImage.height;

			for (; i < maxI;) { // iterate through image bytes

                //if we are done processing the imageData pixes, no need to continue
                if (j >= maxJ) return rawCanvas;

				canvasX = (i / 4) % rawCanvas.width;
				canvasY = Math.floor((i / 4) / rawCanvas.width);

				if (
					canvasX >= left
					&& canvasX < right
				) {
					newCanvasData[i++] = imageData[j++];
					newCanvasData[i++] = imageData[j++];
					newCanvasData[i++] = imageData[j++];
					newCanvasData[i++] = imageData[j++];
				} else {
                    /*newCanvasData[i] = 200;
                    newCanvasData[i + 1] = 200;
                    newCanvasData[i + 2] = 200;
                    newCanvasData[i + 3] = 200;*/
                    //go to next line
                    canvasY++;
                    //and start back at x
                    i = (canvasY * rawCanvas.width + x) * 4;
                }
			}

			return rawCanvas;
		}
	};

	return CanvasWorker;
})();