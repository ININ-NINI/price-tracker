document.addEventListener('DOMContentLoaded', () => {
    const priceForm = document.getElementById('priceForm');
    const priceList = document.getElementById('priceList');
    const deleteModal = document.getElementById('deleteModal');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');

    // 모달 열기/닫기 함수
    function openModal(id) {
        deleteModal.classList.remove('hidden');
        deleteModal.dataset.id = id;
    }
    function closeModal() {
        deleteModal.classList.add('hidden');
        deleteModal.dataset.id = '';
    }

    // 가격 목록 불러오기 및 렌더링
    async function loadPrices() {
        try {
            const response = await fetch('/api/prices');
            const prices = await response.json();
            priceList.innerHTML = '';
            if (prices.length === 0) {
                priceList.innerHTML = '<p>저장된 가격 데이터가 없습니다.</p>';
                return;
            }
            prices.forEach(price => {
                let changeHtml = '';
                if (price.priceChange > 0) {
                    changeHtml = `<span class="price-change positive">▲ +${price.priceChange.toLocaleString()}</span>`;
                } else if (price.priceChange < 0) {
                    changeHtml = `<span class="price-change negative">▼ ${Math.abs(price.priceChange).toLocaleString()}</span>`;
                } else {
                    changeHtml = `<span class="price-change neutral">-</span>`;
                }
                const priceItem = document.createElement('div');
                priceItem.className = 'price-item';
                priceItem.innerHTML = `
                    <div class="item-info">
                        <span class="item-name">${price.itemName}</span>
                        <span class="item-date">${new Date(price.lastUpdated).toLocaleString('ko-KR')}</span>
                    </div>
                    <span class="item-price">${Number(price.currentPrice).toLocaleString()}원 ${changeHtml}</span>
                    <button class="delete-btn" data-id="${price._id}">삭제</button>
                `;
                priceList.appendChild(priceItem);
            });
        } catch (error) {
            console.error('Error:', error);
            priceList.innerHTML = '<p>데이터를 불러오는 중 오류가 발생했습니다.</p>';
        }
    }

    // 폼 제출 처리
    priceForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const itemName = document.getElementById('itemName').value;
        const price = document.getElementById('price').value;
        try {
            const response = await fetch('/api/prices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ itemName, price })
            });
            if (response.ok) {
                priceForm.reset();
                loadPrices();
            }
        } catch (error) {
            alert('데이터 추가 중 오류가 발생했습니다.');
        }
    });

    // 삭제 기능 (이벤트 위임 + 커스텀 모달)
    priceList.addEventListener('click', function(event) {
        if (event.target.classList.contains('delete-btn')) {
            const id = event.target.getAttribute('data-id');
            openModal(id);
        }
    });

    // 모달 취소 버튼
    modalCancelBtn.addEventListener('click', closeModal);

    // 모달 삭제 확인 버튼
    modalConfirmBtn.addEventListener('click', async function() {
        const id = deleteModal.dataset.id;
        if (!id) return;
        try {
            const res = await fetch(`/api/prices/${id}`, { method: 'DELETE' });
            if (res.ok) {
                closeModal();
                loadPrices();
            } else {
                alert('삭제에 실패했습니다.');
            }
        } catch (err) {
            alert('삭제 중 오류가 발생했습니다.');
        }
    });

    // 최초 목록 로드
    loadPrices();
}); 