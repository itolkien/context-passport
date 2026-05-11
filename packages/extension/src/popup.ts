const button = document.querySelector<HTMLButtonElement>("#capture");

button?.addEventListener("click", () => {
  button.textContent = "Capture coming soon";
});
