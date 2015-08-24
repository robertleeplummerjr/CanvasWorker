# unsprite
Decompose css sprite images as strings


Use in browser like:
```javascript
unsprite('class1', 'class2', function callback(dataUrls) {
  dataUrls.forEach(function(dataUrl) {
    ...
  });
}
```
