// ⚠️ এখানে আপনার Central Server এর ngrok লিংকটি বসাবেন
const CENTRAL_SERVER = 'https://jace-nonpuristic-carter.ngrok-free.dev/upload';

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

const fileInput = document.getElementById('fileInput');
const filesList = document.getElementById('filesList');
const uploadForm = document.getElementById('uploadForm');
const messageDiv = document.getElementById('message');
const paymentSection = document.getElementById('paymentSection');
const loading = document.getElementById('loading');
const cancelPaymentBtn = document.getElementById('cancelPayment');
const clearBtn = document.getElementById('clearBtn');
const verifyBtn = document.getElementById('verifyBtn');

// Inputs
const userNameInput = document.getElementById('userName');
const studentIdInput = document.getElementById('studentId');
const trxIdInput = document.getElementById('trxId');
// 🔥 CHANGE: Sender Number Input Removed
const printerLocation = document.getElementById('printerLocation').value;
const collectLaterInput = document.getElementById('collectLater');

let selectedFiles = [];
let currentTotalCost = 0;

// Checkbox a click korle dam update hobe
collectLaterInput.addEventListener('change', updateUI);

// Handle File Selection
fileInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(f => {
        selectedFiles.push({
            file: f,
            copies: 1,
            range: '',
            color: 'bw', // Default B&W
            pageCount: f.name.toLowerCase().endsWith('.pdf') ? '...' : 1
        });
    });
    estimatePageCount();
    updateUI();
});

// Update UI & Calculate Cost
function updateUI() {
    filesList.innerHTML = '';
    let grandTotalCost = 0;

    selectedFiles.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';

        const header = document.createElement('div');
        header.className = 'file-header';
        header.innerHTML = `<span>${item.file.name}</span> <span>${(item.file.size/1024/1024).toFixed(2)} MB</span>`;

        const settingsDiv = document.createElement('div');
        settingsDiv.className = 'settings-row';

        // 🔥 CHECK: File ta Image kina?
        const isImage = item.file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);

        // Pages Input Logic
        let totalPagesInput = '';

        if (isImage) {
            totalPagesInput = '';
        } else if (item.file.name.toLowerCase().endsWith('.pdf')) {
            totalPagesInput = `<div class="input-group"><label>Pages</label><input type="text" value="${item.pageCount}" disabled class="ctrl-input" style="background:#eee; width:50px;"></div>`;
        } else {
            totalPagesInput = `
                <div class="input-group">
                    <label style="color:#d32f2f;">Set Pages</label>
                    <input type="number" min="1" value="${item.pageCount}" 
                       onchange="updateFileSetting(${index}, 'pageCount', this.value)"
                       class="ctrl-input" style="width:60px; border-color:#fca5a5;">
                </div>
            `;
        }

        // Range Input Logic
        let rangeInput = '';
        if (!isImage) {
            rangeInput = `
            <div class="input-group">
                <label>Range</label>
                <input type="text" placeholder="1-5" value="${item.range}" 
                       onchange="updateFileSetting(${index}, 'range', this.value)"
                       class="ctrl-input" style="width:70px;">
            </div>`;
        }

        // HTML Generate
        settingsDiv.innerHTML = `
            ${totalPagesInput}
            ${rangeInput}
            <div class="input-group">
                <label>Copies</label>
                <input type="number" min="1" value="${item.copies}" 
                       onchange="updateFileSetting(${index}, 'copies', this.value)"
                       class="ctrl-input" style="width:50px;">
            </div>
            <div class="input-group">
                <label>Color</label>
                <select onchange="updateFileSetting(${index}, 'color', this.value)" 
                        class="ctrl-select" style="${item.color === 'color' ? 'background:#dcfce7;' : ''}">
                    <option value="bw" ${item.color === 'bw' ? 'selected' : ''}>B&W (2tk)</option>
                    <option value="color" ${item.color === 'color' ? 'selected' : ''}>Color (3tk)</option>
                </select>
            </div>
        `;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => { selectedFiles.splice(index, 1); updateUI(); };

        div.appendChild(header);
        div.appendChild(settingsDiv);
        div.appendChild(removeBtn);
        filesList.appendChild(div);

        // --- COST CALCULATION ---
        let rawTotal = parseInt(item.pageCount);
        if (isNaN(rawTotal)) rawTotal = 1;

        let estimatedPages = rawTotal;
        if(item.range && item.range.includes('-')) {
            const parts = item.range.split('-');
            const start = parseInt(parts[0]);
            const end = parseInt(parts[1]);
            if(!isNaN(start) && !isNaN(end) && end >= start) {
                const safeEnd = Math.min(end, rawTotal);
                if (safeEnd >= start) estimatedPages = (safeEnd - start) + 1;
            }
        } else if (item.range && !isNaN(parseInt(item.range))) {
            estimatedPages = 1;
        }

        const costPerSheet = item.color === 'bw' ? 2 : 3;
        const fileCost = estimatedPages * item.copies * costPerSheet;
        item.calculatedCost = fileCost;

        grandTotalCost += fileCost;
    });

    // Collect Later Extra Charge
    if (collectLaterInput.checked && selectedFiles.length > 0) {
        grandTotalCost += 1;
    }

    currentTotalCost = grandTotalCost;

    document.getElementById('totalCost').textContent = currentTotalCost;
    document.getElementById('payAmountDisplay').textContent = currentTotalCost;
}

window.updateFileSetting = function(index, key, value) {
    selectedFiles[index][key] = value;
    updateUI();
};

async function estimatePageCount() {
    for (let item of selectedFiles) {
        if (item.file.name.toLowerCase().endsWith('.pdf') && item.pageCount === '...') {
            try {
                const buff = await item.file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({data: buff}).promise;
                item.pageCount = pdf.numPages;
            } catch(e) { item.pageCount = '?'; }
        }
    }
    updateUI();
}

// Button Actions
clearBtn.onclick = () => { selectedFiles = []; updateUI(); };
cancelPaymentBtn.onclick = () => paymentSection.classList.remove('show');

uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!userNameInput.value.trim() || !studentIdInput.value.trim()) {
        return showMessage('Please fill in your Name and ID!', 'error');
    }
    if (selectedFiles.length === 0) {
        return showMessage('Please upload at least one file!', 'error');
    }

    trxIdInput.value = '';
    // SenderNum Clear removed

    // NAGAD HIDE LOGIC
    const nagadWrapper = document.getElementById('nagadWrapper');
    const nagadMsg = document.getElementById('nagadLowAmountMsg');

    if (currentTotalCost < 10) {
        nagadWrapper.style.display = 'none';
        nagadMsg.style.display = 'block';
    } else {
        nagadWrapper.style.display = 'block';
        nagadMsg.style.display = 'none';
    }

    paymentSection.classList.add('show');
});

// Verify & Upload Logic
verifyBtn.onclick = async () => {
    const trxId = trxIdInput.value.trim();

    if (!trxId) return showMessage('Please enter Transaction ID!', 'error');

    // 🔥 CHANGE: Removed Sender Number Check

    const originalBtnText = verifyBtn.innerHTML;
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `<div class="btn-spinner"></div> Verifying...`;

    try {
        const verifyUrl = CENTRAL_SERVER.replace('/upload', '') + '/verify-payment';

        const verifyRes = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                trx_id: trxId,
                // 🔥 CHANGE: No sender_num sent
                amount: currentTotalCost
            })
        });

        const verifyResult = await verifyRes.json();

        if (!verifyRes.ok) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = originalBtnText;

            if (verifyResult.error_type === 'underpayment') {
                alert(verifyResult.message);
            } else {
                showMessage(verifyResult.message, 'error');
            }
            return;
        }

        if (verifyResult.warning) {
            alert(verifyResult.message);
        }

        // Proceed to Upload
        verifyBtn.innerHTML = `<div class="btn-spinner"></div> Uploading...`;
        loading.classList.add('show');

        const formData = new FormData();
        formData.append('userName', userNameInput.value.trim());
        formData.append('studentId', studentIdInput.value.trim());
        formData.append('location', printerLocation);
        formData.append('trxId', trxId);
        // 🔥 CHANGE: No senderNum appended
        formData.append('totalCost', currentTotalCost);
        formData.append('collectLater', collectLaterInput.checked);

        selectedFiles.forEach(item => formData.append('files', item.file));
        const settings = selectedFiles.map(item => ({
            fileName: item.file.name,
            range: item.range,
            copies: item.copies,
            color: item.color,
            cost: item.calculatedCost || 0,
            pages: item.pageCount
        }));
        formData.append('fileSettings', JSON.stringify(settings));

        const uploadRes = await fetch(CENTRAL_SERVER, { method: 'POST', body: formData });
        const uploadResult = await uploadRes.json();

        loading.classList.remove('show');
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;

        if (uploadRes.ok) {
            showMessage(`✅ Order Verified & Sent!`, 'success');
            selectedFiles = [];
            collectLaterInput.checked = false; // Reset checkbox
            updateUI();
            paymentSection.classList.remove('show');
            uploadForm.reset();
        } else {
            showMessage('❌ Upload Failed: ' + (uploadResult.error || 'Server Error'), 'error');
        }

    } catch (err) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = originalBtnText;
        loading.classList.remove('show');
        console.error(err);
        showMessage('❌ Server Connection Error!', 'error');
    }
};

function showMessage(t, type) {
    messageDiv.textContent = t;
    messageDiv.className = 'toast show ' + type;
    setTimeout(()=>messageDiv.className='toast', 4000);
}