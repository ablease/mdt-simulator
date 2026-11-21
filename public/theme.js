// Applies the theme chosen in Settings before the page is drawn, so it doesn't flash the other one.
// Kept as a separate file because the security policy doesn't allow scripts written into the page.
try {
  var theme = localStorage.getItem("mdt.ui.theme");
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch (e) {}
