(function () {
  "use strict";

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  async function loadPublicPrices() {
    var nodes = document.querySelectorAll("[data-price-key]");
    if (!nodes.length) return;

    try {
      var res = await fetch("/api/prices", { cache: "no-store" });
      var data = await res.json();
      if (!res.ok || !data.ok || !Array.isArray(data.prices)) throw new Error("invalid prices");

      var prices = {};
      data.prices.forEach(function (item) {
        prices[item.productKey] = item.basePrice;
      });

      nodes.forEach(function (node) {
        var key = node.getAttribute("data-price-key");
        if (Object.prototype.hasOwnProperty.call(prices, key)) {
          node.textContent = formatCurrency(prices[key]);
        } else {
          node.textContent = "Preço sob consulta";
        }
      });
    } catch (error) {
      nodes.forEach(function (node) {
        node.textContent = "Preço sob consulta";
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPublicPrices);
  } else {
    loadPublicPrices();
  }
})();
