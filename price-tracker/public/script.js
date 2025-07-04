function renderDashboard(data) {
  const dashboard = document.getElementById('price-dashboard');
  dashboard.innerHTML = '';
  data.forEach(item => {
    const card = document.createElement('div');
    card.className = 'price-card';

    const category = document.createElement('div');
    category.className = 'category';
    category.textContent = item.category + (item.unit ? ` (${item.unit} 기준)` : '');

    const priceInfo = document.createElement('div');
    priceInfo.className = 'price-info';

    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = item.avg_price.toLocaleString() + '원';

    const change = document.createElement('span');
    let changeVal = item.change_pct;
    change.className = 'change ' + (changeVal > 0 ? 'positive' : (changeVal < 0 ? 'negative' : ''));
    if (changeVal === null || isNaN(changeVal)) {
      change.textContent = '(변동 없음)';
    } else {
      change.textContent = (changeVal > 0 ? '+' : '') + changeVal + '%';
    }

    priceInfo.appendChild(price);
    priceInfo.appendChild(change);

    card.appendChild(category);
    card.appendChild(priceInfo);
    dashboard.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/summary')
    .then(res => res.json())
    .then(data => renderDashboard(data));
});