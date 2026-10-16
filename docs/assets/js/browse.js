(function () {
  var dataUrl = window.SOUND_STUDENT_DATA;
  if (!dataUrl) return;

  var listEl = document.getElementById("browse-list");
  var metaEl = document.getElementById("browse-meta");
  var qEl = document.getElementById("browse-q");
  var filtersEl = document.getElementById("browse-filters");
  var items = [];
  var activeCat = "";

  function render() {
    var q = (qEl && qEl.value || "").trim().toLowerCase();
    var filtered = items.filter(function (item) {
      if (activeCat && item.category !== activeCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().indexOf(q) !== -1 ||
        item.category.toLowerCase().indexOf(q) !== -1
      );
    });

    if (metaEl) {
      metaEl.textContent = filtered.length + " of " + items.length + " tools";
    }

    if (!listEl) return;
    listEl.innerHTML = filtered
      .map(function (item) {
        return (
          "<li>" +
          '<a href="' +
          item.url +
          '" rel="noopener">' +
          escapeHtml(item.name) +
          "</a>" +
          '<span class="browse-cat">' +
          escapeHtml(item.category) +
          "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  function buildFilters(categories) {
    if (!filtersEl) return;
    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "filter-chip is-active";
    allBtn.textContent = "All";
    allBtn.addEventListener("click", function () {
      activeCat = "";
      filtersEl.querySelectorAll(".filter-chip").forEach(function (b) {
        b.classList.remove("is-active");
      });
      allBtn.classList.add("is-active");
      render();
    });
    filtersEl.appendChild(allBtn);

    categories.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-chip";
      btn.textContent = cat;
      btn.addEventListener("click", function () {
        activeCat = cat;
        filtersEl.querySelectorAll(".filter-chip").forEach(function (b) {
          b.classList.remove("is-active");
        });
        btn.classList.add("is-active");
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
      if (qEl) qEl.addEventListener("input", render);
      render();
    })
    .catch(function () {
      if (metaEl) metaEl.textContent = "Could not load catalog JSON.";
    });
})();
