const dom = {
  byId: function (id) {
    return document.getElementById(id);
  },
  byTagName: function (tagName) {
    return document.getElementsByTagName(tagName)[0];
  },
  createElement: function (sNodeType, options) {
    let node = document.createElement(sNodeType);
    if (options.text) {
      node.innerText = options.text;
    }
    if (options.attr) {
      node.setAttribute(options.attr.key, options.attr.value);
    }
    if (options.html) {
      node.innerHTML = options.html;
    }
    if (options.class) {
      node.classList.add(options.class);
    }
    return node;
  },
};
