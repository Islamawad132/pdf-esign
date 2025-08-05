pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfDoc = null;
let currentPage = 1;
let scale = 1.5;
let signatureImg = null;
let pdfCanvas = document.getElementById('pdf-canvas');
let ctx = pdfCanvas.getContext('2d');
let signatureLayer = document.getElementById('signature-layer');

document.getElementById('pdf-upload').addEventListener('change', handlePDFUpload);
document.getElementById('signature-upload').addEventListener('change', handleSignatureUpload);
document.getElementById('save-pdf').addEventListener('click', savePDFWithSignature);
document.getElementById('clear-signature').addEventListener('click', clearSignatures);

async function handlePDFUpload(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        document.getElementById('pdf-name').textContent = file.name;
        document.querySelector('.empty-state').style.display = 'none';
        
        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            
            try {
                pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
                renderPage(currentPage);
                updateSaveButton();
            } catch (error) {
                alert('Error loading PDF: ' + error.message);
            }
        };
        
        fileReader.readAsArrayBuffer(file);
    }
}

async function renderPage(pageNum) {
    if (!pdfDoc) return;
    
    try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale });
        
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        signatureLayer.style.width = viewport.width + 'px';
        signatureLayer.style.height = viewport.height + 'px';
    } catch (error) {
        console.error('Error rendering page:', error);
    }
}

function handleSignatureUpload(e) {
    const file = e.target.files[0];
    if (file && file.type === 'image/png') {
        document.getElementById('sig-name').textContent = file.name;
        
        const reader = new FileReader();
        
        reader.onload = function(event) {
            signatureImg = new Image();
            signatureImg.onload = function() {
                createSignatureElement(this);
                updateSaveButton();
            };
            signatureImg.src = event.target.result;
        };
        
        reader.readAsDataURL(file);
    }
}

function createSignatureElement(img) {
    signatureLayer.innerHTML = '';
    
    const signatureDiv = document.createElement('div');
    signatureDiv.className = 'signature-element';
    signatureDiv.style.width = '150px';
    signatureDiv.style.height = 'auto';
    signatureDiv.style.left = '50px';
    signatureDiv.style.top = '50px';
    
    const signatureImage = document.createElement('img');
    signatureImage.src = img.src;
    signatureImage.style.width = '100%';
    signatureImage.style.height = 'auto';
    signatureImage.draggable = false;
    
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    
    signatureDiv.appendChild(signatureImage);
    signatureDiv.appendChild(resizeHandle);
    signatureLayer.appendChild(signatureDiv);
    
    makeDraggable(signatureDiv);
    makeResizable(signatureDiv, resizeHandle);
    updateSaveButton();
}

function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    
    element.addEventListener('mousedown', function(e) {
        if (e.target.className === 'resize-handle') return;
        
        isDragging = true;
        element.classList.add('dragging');
        
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = element.offsetLeft;
        initialTop = element.offsetTop;
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;
        
        newLeft = Math.max(0, Math.min(newLeft, signatureLayer.offsetWidth - element.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, signatureLayer.offsetHeight - element.offsetHeight));
        
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
    });
    
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            element.classList.remove('dragging');
        }
    });
}

function makeResizable(element, handle) {
    let isResizing = false;
    let startX, startY, startWidth;
    
    handle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(element.style.width, 10);
        e.preventDefault();
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + deltaX);
        
        element.style.width = newWidth + 'px';
    });
    
    document.addEventListener('mouseup', function() {
        isResizing = false;
    });
}

function clearSignatures() {
    signatureLayer.innerHTML = '';
    signatureImg = null;
    document.getElementById('sig-name').textContent = '';
    document.getElementById('signature-upload').value = '';
    updateSaveButton();
}

function updateSaveButton() {
    const saveButton = document.getElementById('save-pdf');
    const clearButton = document.getElementById('clear-signature');
    const hasSignature = signatureLayer.children.length > 0;
    
    saveButton.disabled = !(pdfDoc && signatureImg && hasSignature);
    clearButton.disabled = !hasSignature;
}

async function savePDFWithSignature() {
    if (!pdfDoc || !signatureImg) return;
    
    const signatureElement = signatureLayer.querySelector('.signature-element');
    if (!signatureElement) return;
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: pdfCanvas.width > pdfCanvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [pdfCanvas.width / scale, pdfCanvas.height / scale]
    });
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pdfCanvas.width;
    tempCanvas.height = pdfCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(pdfCanvas, 0, 0);
    
    const signatureLeft = parseInt(signatureElement.style.left, 10);
    const signatureTop = parseInt(signatureElement.style.top, 10);
    const signatureWidth = parseInt(signatureElement.style.width, 10);
    const signatureHeight = signatureElement.querySelector('img').offsetHeight;
    
    tempCtx.drawImage(signatureImg, signatureLeft, signatureTop, signatureWidth, signatureHeight);
    
    const imgData = tempCanvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, pdfCanvas.width / scale, pdfCanvas.height / scale);
    
    pdf.save('signed-document.pdf');
}