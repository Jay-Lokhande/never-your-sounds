(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav-main");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
})();
