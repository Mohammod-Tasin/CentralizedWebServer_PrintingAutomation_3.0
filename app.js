// ⚠️ এখানে আপনার Central Server এর ngrok লিংকটি বসাবেন
const CENTRAL_SERVER = 'https://jace-nonpuristic-carter.ngrok-free.dev/upload';

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

const fileInput = document.getElementById('fileInput');
const filesList = document.getElementById('filesList');
const printerSelect = document.getElementById('printerSelect');
const uploadForm = document.getElementById('uploadForm');
const messageDiv = document.getElementById('message');
const paymentSection = document.getElementById('paymentSection');
const loading = document.getElementById('loading');
const cancelPaymentBtn = document.getElementById('cancelPayment');
const clearBtn = document.getElementById('clearBtn');

let selectedFiles = [];

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
    let totalPagesToPrint = 0;

    selectedFiles.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';

        const header = document.createElement('div');
        header.className = 'file-header';
        header.innerHTML = `<span>${item.file.name}</span> <span>${(item.file.size/1024/1024).toFixed(2)} MB</span>`;

        const settingsDiv = document.createElement('div');
        settingsDiv.className = 'settings-row';

        // 1. Pages Input (Auto for PDF, Manual for others)
        let totalPagesInput = '';
        if (item.file.name.toLowerCase().endsWith('.pdf')) {
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

        settingsDiv.innerHTML = `
            ${totalPagesInput}
            
            <div class="input-group">
                <label>Range</label>
                <input type="text" placeholder="1-5" value="${item.range}" 
                       onchange="updateFileSetting(${index}, 'range', this.value)"
                       class="ctrl-input" style="width:70px;">
            </div>

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
                    <option value="color" ${item.color === 'color' ? 'selected' : ''}>Color (3.5tk)</option>
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

        // Price Logic: B&W = 2tk, Color = 3.5tk
        const costPerSheet = item.color === 'bw' ? 2 : 3.5;
        const fileCost = estimatedPages * item.copies * costPerSheet;
        item.calculatedCost = fileCost;

        grandTotalCost += fileCost;
        totalPagesToPrint += (estimatedPages * item.copies);
    });

    document.getElementById('totalCost').textContent = grandTotalCost.toFixed(2);

    // Update Payment Modal Info
    document.getElementById('paymentAmount').textContent = grandTotalCost.toFixed(2) + " Tk";
    document.getElementById('paymentPages').textContent = totalPagesToPrint;
    document.getElementById('paymentFiles').textContent = selectedFiles.length;
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
    if (!printerSelect.value) return showMessage('Please select a printer location!', 'error');
    if (selectedFiles.length === 0) return showMessage('Please upload at least one file!', 'error');

    document.getElementById('paymentPrinter').textContent = printerSelect.options[printerSelect.selectedIndex].text;
    paymentSection.classList.add('show');
});

// Process Payment & Upload
async function processPayment(gateway) {
    loading.classList.add('show');
    const selectedLocation = printerSelect.value;

    try {
        const formData = new FormData();
        selectedFiles.forEach(item => formData.append('files', item.file));

        // Send Settings + Cost to Server
        const settings = selectedFiles.map(item => ({
            range: item.range,
            copies: item.copies,
            color: item.color,
            cost: item.calculatedCost || 0
        }));
        formData.append('fileSettings', JSON.stringify(settings));
        formData.append('location', selectedLocation);
        formData.append('gateway', gateway);

        const res = await fetch(CENTRAL_SERVER, { method: 'POST', body: formData });
        const result = await res.json();

        loading.classList.remove('show');
        if (res.ok) {
            showMessage(`✅ Order Sent to ${selectedLocation}!`, 'success');
            selectedFiles = []; updateUI(); paymentSection.classList.remove('show');
        } else {
            showMessage('❌ Failed: ' + (result.error || 'Server Error'), 'error');
        }
    } catch (err) {
        loading.classList.remove('show');
        console.error(err);
        showMessage('❌ Server Connection Error!', 'error');
    }
}

// Payment Buttons
document.getElementById('bkashBtn').onclick = () => processPayment('bKash');
document.getElementById('nagadBtn').onclick = () => processPayment('Nagad');
document.getElementById('stripeBtn').onclick = () => processPayment('Stripe');

function showMessage(t, type) {
    messageDiv.textContent = t;
    messageDiv.className = 'toast show ' + type;
    setTimeout(()=>messageDiv.className='toast', 4000);
}