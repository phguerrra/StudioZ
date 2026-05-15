(function () {
  "use strict";

  var form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var email = document.getElementById("email");
    var password = document.getElementById("password");
    [email, password].forEach(function (el) {
      el.closest(".form-group").classList.remove("invalid");
    });

    var ok = true;
    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      email.closest(".form-group").classList.add("invalid");
      email.closest(".form-group").querySelector(".error-msg").textContent = "E-mail inválido.";
      ok = false;
    }
    if (!password.value) {
      password.closest(".form-group").classList.add("invalid");
      ok = false;
    }
    if (!ok) return;

    var res = await window.loginUser(email.value, password.value);
    if (!res.ok) {
      if (window.showToast) window.showToast(res.message, "error");
      return;
    }
    if (window.showToast) window.showToast("Bem-vindo de volta!", "success");
    setTimeout(function () {
      window.location.href = "pedidos.html";
    }, 600);
  });
})();
