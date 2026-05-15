(function () {
  "use strict";

  var navToggle = document.querySelector(".nav-toggle");
  var mainNav = document.querySelector(".main-nav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      mainNav.classList.toggle("is-open");
      var icon = navToggle.querySelector("i");
      if (icon) {
        icon.className = mainNav.classList.contains("is-open")
          ? "fas fa-times"
          : "fas fa-bars";
      }
    });
    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.matchMedia("(max-width: 960px)").matches) {
          mainNav.classList.remove("is-open");
          var ic = navToggle.querySelector("i");
          if (ic) ic.className = "fas fa-bars";
        }
      });
    });
  }

  var path = window.location.pathname.split("/").pop() || "index.html";
  if (!path || path.indexOf(".html") === -1) path = "index.html";
  document.querySelectorAll(".main-nav a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      a.classList.add("active");
    }
  });
})();

window.showToast = function (message, type) {
  type = type || "success";
  var el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(function () {
    el.remove();
  }, 3800);
};

window.StudioZStorage = {
  USERS: "studioz_users",
  SESSION: "studioz_session",
  ORDERS: "studioz_orders",
};
