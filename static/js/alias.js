(function () {
  function askAlias(prev) {
    var a = window.prompt("Enter your alias", prev || "");
    if (a == null) return prev || "";
    a = a.trim();
    return a || prev || "Player";
  }

  function showGreeting(alias) {
    var el = document.getElementById("alias-greeting");
    if (!el) return;
    el.textContent = "Hello $alias: " + alias;
  }

  var key = "the101game.alias";
  var alias = localStorage.getItem(key) || "";
  if (!alias) {
    alias = askAlias(alias);
    localStorage.setItem(key, alias);
  }
  showGreeting(alias);

  // Bonus: dubbelklik op de tekst om alias te wijzigen
  var el = document.getElementById("alias-greeting");
  if (el) {
    el.style.cursor = "pointer";
    el.title = "Double-click to change alias";
    el.ondblclick = function () {
      var cur = localStorage.getItem(key) || "";
      var nxt = askAlias(cur);
      localStorage.setItem(key, nxt);
      showGreeting(nxt);
    };
  }
})();
