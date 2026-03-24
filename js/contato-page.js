(function () {
  "use strict";

  var form = document.getElementById("contatoForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var nome = document.getElementById("contatoNome");
    var email = document.getElementById("contatoEmail");
    var msg = document.getElementById("contatoMensagem");

    [nome, email, msg].forEach(function (el) {
      el.closest(".form-group").classList.remove("invalid");
    });

    var ok = true;
    if (!nome.value.trim()) {
      nome.closest(".form-group").classList.add("invalid");
      ok = false;
    }
    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      email.closest(".form-group").classList.add("invalid");
      email.closest(".form-group").querySelector(".error-msg").textContent = "E-mail inválido.";
      ok = false;
    }
    if (!msg.value.trim()) {
      msg.closest(".form-group").classList.add("invalid");
      ok = false;
    }
    if (!ok) {
      if (window.showToast) window.showToast("Preencha todos os campos corretamente.", "error");
      return;
    }

    try {
      var res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.value.trim(),
          email: email.value.trim().toLowerCase(),
          mensagem: msg.value.trim(),
        }),
      });
      var data = await res.json();
      if (!res.ok || !data.ok) {
        if (window.showToast) window.showToast(data.message || "Erro ao enviar mensagem.", "error");
        return;
      }
      if (window.showToast) {
        window.showToast("Mensagem enviada! Entraremos em contato em breve.", "success");
      }
      form.reset();
    } catch (err) {
      if (window.showToast) window.showToast("Servidor indisponível no momento.", "error");
    }
  });
})();
