var CanvasWorker = (function() {
	"use strict";

	function CanvasWorker(urls, settings) {

		settings = this.setDefaults(settings);

		this.canvas = document.createElement('canvas');
		settings.element.appendChild(this.canvas);
		this.canvas.width = settings.element.clientWidth;
		this.canvas.height = settings.element.clientHeight;
		this.context = this.canvas.getContext('2d');

		this.imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
		this.urls = urls;
		this.urlData = {};
		this.operative = operative(CanvasWorker.thread);
		this.images = [];
		this.raw = [];

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
		render: function(callback) {
			var me = this;
			this.operative.drawEach(this.settings.compose, this.raw, this.imageData, function(merged) {
				me.context.putImageData(merged, 0, 0);

				callback();
			});

			return this;
		}
	};

	CanvasWorker.defaultSettings = {
		drawFinished: function() {},
		tiles: 8,
		compose: null,
		element: null
	};

	CanvasWorker.thread = {
		drawEach: function(compose, rawImages, rawCanvas, callback) {
			var i = 0,
				max = compose.length,
				c;

			for (;i < max; i++) {
				c = compose[i];
				rawCanvas = this.draw(rawCanvas, rawImages[c.image], c.x, c.y);
			}

			callback(rawCanvas);
		},
		draw: function( rawCanvas, rawImage, x, y ) {
			var newCanvasData = rawCanvas.data,
				imageData = rawImage.data,
				i = 0,
				j = 0,
				max = newCanvasData.length,
				canvasX,
				canvasY;

			for (; i < max;) { // iterate through image bytes

				canvasY = (i / 4) % rawCanvas.width;
				canvasX = Math.floor((i / 4) / rawCanvas.width);

				if (
					canvasX >= x
					&& canvasY >= y
					&& canvasX <= rawImage.width + x
					&& canvasY <= rawImage.height + y
				) {
					newCanvasData[i++] = imageData[j++];
					newCanvasData[i++] = imageData[j++];
					newCanvasData[i++] = imageData[j++];
					newCanvasData[i++] = imageData[j++];
				} else {
					i+=4;
				}
			}

			return rawCanvas;
		}
	};

	return CanvasWorker;
})();