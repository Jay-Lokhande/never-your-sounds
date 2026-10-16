(function () {
  var dataUrl = window.NYS_CATALOG_DATA;
  if (!dataUrl) return;

  var listEl = document.getElementById("browse-list");
  var metaEl = document.getElementById("browse-meta");
  var qEl = document.getElementById("browse-q");
  var filtersEl = document.getElementById("browse-filters");
  var items = [];
  var activeCat = "";

  function getQueryCat() {
    var params = new URLSearchParams(window.location.search);
    return params.get("cat") || "";
  }

  function render() {
    var q = (qEl && qEl.value || "").trim().toLowerCase();
    var filtered = items.filter(function (item) {
      if (activeCat && item.category !== activeCat) return false;
      if (!q) return true;
      var tagStr = (item.tags || []).join(" ").toLowerCase();
      return (
        item.name.toLowerCase().indexOf(q) !== -1 ||
        item.category.toLowerCase().indexOf(q) !== -1 ||
        tagStr.indexOf(q) !== -1
      );
    });

    if (metaEl) {
      metaEl.textContent = filtered.length + " of " + items.length + " tools";
    }

    if (!listEl) return;
    listEl.innerHTML = filtered
      .map(function (item) {
        var badges =
          (item.cost
            ? '<span class="browse-badge browse-cost">' + escapeHtml(item.cost) + "</span>"
            : "") +
          (item.platform && item.platform.length
            ? item.platform
                .map(function (p) {
                  return '<span class="browse-badge browse-plat">' + escapeHtml(p) + "</span>";
                })
                .join("")
            : "");
        return (
          "<li>" +
          '<div class="browse-item-main">' +
          '<a href="' +
          item.url +
          '" rel="noopener">' +
          escapeHtml(item.name) +
          "</a>" +
          '<span class="browse-cat">' +
          escapeHtml(item.category) +
          "</span>" +
          "</div>" +
          (badges ? '<div class="browse-badges">' + badges + "</div>" : "") +
          "</li>"
        );
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  function setActiveFilter(cat) {
    activeCat = cat;
    if (!filtersEl) return;
    filtersEl.querySelectorAll(".filter-chip").forEach(function (b) {
      var match = !cat ? b.textContent === "All" : b.dataset.cat === cat;
      b.classList.toggle("is-active", match);
    });
  }

  function buildFilters(categories) {
    if (!filtersEl) return;
    filtersEl.innerHTML = "";
    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "filter-chip";
    allBtn.textContent = "All";
    allBtn.addEventListener("click", function () {
      setActiveFilter("");
      history.replaceState(null, "", window.location.pathname);
      render();
    });
    filtersEl.appendChild(allBtn);

    categories.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-chip";
      btn.dataset.cat = cat;
      btn.textContent = cat;
      btn.addEventListener("click", function () {
        setActiveFilter(cat);
        history.replaceState(null, "", "?cat=" + encodeURIComponent(cat));
        render();
      });
      filtersEl.appendChild(btn);
    });
  }

  fetch(dataUrl)
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      items = data.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
      var cats = [];
      items.forEach(function (i) {
        if (cats.indexOf(i.category) === -1) cats.push(i.category);
      });
      cats.sort();
      buildFilters(cats);
      var initial = getQueryCat();
      if (initial && cats.indexOf(initial) !== -1) {
        setActiveFilter(initial);
      } else {
        setActiveFilter("");
      }
      if (qEl) qEl.addEventListener("input", render);
      render();
    })
    .catch(function () {
      if (metaEl) metaEl.textContent = "Could not load catalog JSON.";
    });
})();
