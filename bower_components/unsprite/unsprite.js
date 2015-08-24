function unsprite() {
  var i = 0,
    className,
    max = arguments.length - 1,
    callback = arguments[max],
    drawn = 0,
    images = [],
    body = document.querySelector('body'),
    res = unsprite.res();

  if (callback === undefined) throw new Error('Not enough arguments');

  for(;i < max; i++) {
    className = arguments[i];

    (function() {
      var div = document.createElement('div'),
        img = new Image(),
        unSpriteImg = new Image(),
        unSpriteCanvas = document.createElement('canvas'),
        style;

      div.className = className;
      body.appendChild(div);

      style = window.getComputedStyle(div);
      images.push(unSpriteImg);
      img.onload = function () {
        drawn++;

        var canvas = document.createElement('canvas'),
          context,
          backgroundPosition = style.backgroundPosition.split(' '),
          w = style.width.replace('px', '') * res,
          h = style.height.replace('px', '') * res,
          x = Math.abs(backgroundPosition[0].replace('px', '') * 1),
          y = Math.abs(backgroundPosition[1].replace('px', '') * 1);

        canvas.width = this.width;
        canvas.height = this.height;

        context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(this, 0, 0);

        //detect cross origin and don't blow up
        try {
          unSpriteCanvas.getContext('2d').putImageData(context.getImageData(
            x,
            y,
            unSpriteCanvas.width = w,
            unSpriteCanvas.height = h
          ), 0, 0);
        } catch (e) {
          console.log(e);
        }

        unSpriteImg.src = unSpriteCanvas.toDataURL();

        body.removeChild(div);

        if (drawn === max) {
          callback(images);
        }
      };

      img.src = style.backgroundImage
        .replace(/"/g, '')
        .replace(/^url[(]/, '')
        .replace(/[)]$/, '');
    })();
  }
}
unsprite.res = function res() {
  if (window.hasOwnProperty('devicePixelRatio') && window.devicePixelRatio > 1) {
    return window.devicePixelRatio;
  } else if (window.matchMedia && window.matchMedia("(-webkit-min-device-pixel-ratio: 1.5),(-moz-min-device-pixel-ratio: 1.5),(min-device-pixel-ratio: 1.5)").matches) {
    return 1.5;
  }
  return 1;
};