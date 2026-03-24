(function () {
  "use strict";

  function run() {
    var user = window.getCurrentUser && window.getCurrentUser();
    var slot = document.getElementById("navUserSlot");
    if (!slot) return;
    if (user) {
      slot.innerHTML =
        '<span class="nav-user-name" style="font-size:0.85rem;color:#64748b;margin-right:0.5rem;">Olá, ' +
        escapeAttr(user.name.split(" ")[0]) +
        '</span><a href="#" id="navLogout" class="btn btn-outline" style="padding:0.35rem 0.85rem;font-size:0.85rem;">Sair</a>';
      var lo = document.getElementById("navLogout");
      if (lo) {
        lo.addEventListener("click", function (e) {
          e.preventDefault();
          window.logoutUser && window.logoutUser();
          window.location.href = "index.html";
        });
      }
    }
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
