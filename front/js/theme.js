// Alterna entre os dois padrões de cor: "dark" e "light".
// O tema inicial já é aplicado pelo script inline no <head> (anti-flash).

const btn = document.getElementById('btn-theme');

function current() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

function render(theme) {
  if (!btn) return;
  // Mostra o ícone do tema para o qual o clique vai mudar.
  btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  btn.title = theme === 'dark' ? 'Mudar para tema White' : 'Mudar para tema Dark';
}

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  render(theme);
}

render(current());

btn?.addEventListener('click', () => {
  apply(current() === 'dark' ? 'light' : 'dark');
});
