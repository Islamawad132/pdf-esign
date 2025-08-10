// Wait for DOM and scripts to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme and language systems
    initializeTheme();
    initializeLanguage();
    initializeNavigation();
    
    // Set PDF.js worker source when available
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    
    let pdfDoc = null;
    let currentPage = 1;
    let scale = 1.5;
    let signatureImg = null;
    let pdfCanvas = document.getElementById('pdf-canvas');
    let ctx = pdfCanvas.getContext('2d');
    let signatureLayer = document.getElementById('signature-layer');

    // Initialize event listeners
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

// Close DOMContentLoaded event listener
});

// Theme Management System
function initializeTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    
    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    // Theme toggle event listener (with mobile support)
    if (themeToggle) {
        const toggleTheme = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
            
            // Add animation effect
            themeToggle.style.transform = 'scale(0.9)';
            setTimeout(() => {
                themeToggle.style.transform = 'scale(1)';
            }, 150);
        };
        
        // Add both click and touch events for mobile compatibility
        themeToggle.addEventListener('click', toggleTheme);
        themeToggle.addEventListener('touchend', toggleTheme);
        
        // Prevent default touch behaviors
        themeToggle.addEventListener('touchstart', function(e) {
            e.preventDefault();
        });
    }
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    const icon = themeToggle?.querySelector('i');
    
    if (icon) {
        if (theme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }
}

// Language Management System
function initializeLanguage() {
    const langToggle = document.getElementById('lang-toggle');
    const html = document.documentElement;
    
    // Load saved language or default to Arabic
    const savedLang = localStorage.getItem('language') || 'ar';
    setLanguage(savedLang);
    
    // Language toggle event listener (with mobile support)
    if (langToggle) {
        const toggleLanguage = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const currentLang = html.getAttribute('lang');
            const newLang = currentLang === 'ar' ? 'en' : 'ar';
            
            setLanguage(newLang);
            localStorage.setItem('language', newLang);
            
            // Add animation effect
            langToggle.style.transform = 'scale(0.9)';
            setTimeout(() => {
                langToggle.style.transform = 'scale(1)';
            }, 150);
        };
        
        // Add both click and touch events for mobile compatibility
        langToggle.addEventListener('click', toggleLanguage);
        langToggle.addEventListener('touchend', toggleLanguage);
        
        // Prevent default touch behaviors
        langToggle.addEventListener('touchstart', function(e) {
            e.preventDefault();
        });
    }
}

function setLanguage(lang) {
    const html = document.documentElement;
    const langToggle = document.getElementById('lang-toggle');
    const langText = langToggle?.querySelector('.lang-text');
    const sidebar = document.getElementById('sidebar');
    
    // Update HTML attributes
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    
    // Update toggle button text
    if (langText) {
        langText.textContent = lang === 'ar' ? 'EN' : 'ع';
    }
    
    // Force layout recalculation after direction change
    if (sidebar) {
        // Temporarily hide sidebar to prevent visual glitch
        sidebar.style.transition = 'none';
        sidebar.offsetHeight; // Force reflow
        sidebar.style.transition = 'all 0.3s ease';
        
        // Reset sidebar state based on screen size
        if (window.innerWidth <= 991) {
            sidebar.classList.remove('active');
        }
        
        // Clear any inline styles to let CSS handle direction
        sidebar.style.transform = '';
        sidebar.style.width = '';
        sidebar.style.height = '';
        sidebar.style.top = '';
        sidebar.style.left = '';
        sidebar.style.right = '';
    }
    
    // Update all translatable elements
    updateTranslations(lang);
}

function updateTranslations(lang) {
    const elements = document.querySelectorAll('[data-en][data-ar]');
    
    elements.forEach(element => {
        const translation = lang === 'ar' ? element.getAttribute('data-ar') : element.getAttribute('data-en');
        if (translation) {
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        }
    });
    
    // Update placeholders separately
    const placeholderElements = document.querySelectorAll('[data-en-placeholder][data-ar-placeholder]');
    placeholderElements.forEach(element => {
        const placeholder = lang === 'ar' ? element.getAttribute('data-ar-placeholder') : element.getAttribute('data-en-placeholder');
        if (placeholder) {
            element.placeholder = placeholder;
        }
    });
}

// Navigation Management System
function initializeNavigation() {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebarEl = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const mainContent = document.querySelector('.main-content');
    
    console.log('Initializing navigation...', { mobileMenuToggle, sidebarEl, sidebarOverlay }); // Debug
    console.log('Current language direction:', document.documentElement.getAttribute('dir')); // Debug
    
    // Mobile menu toggle
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            console.log('Mobile menu clicked'); // Debug
            toggleSidebar();
        });
    }
    
    // Sidebar overlay click to close
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            closeSidebar();
        });
    }
    
    // Close sidebar when clicking on close button (mobile)
    if (sidebarEl) {
        sidebarEl.addEventListener('click', function(e) {
            // Check if clicked on the close button (::before pseudo-element)
            const rect = sidebarEl.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // Close button area (top-right 70x70 pixels on mobile and tablet)
            if (window.innerWidth <= 991) {
                const isRTL = document.documentElement.getAttribute('dir') === 'rtl';
                const closeButtonArea = isRTL ? 
                    (clickX <= 70 && clickY <= 70) : 
                    (clickX >= rect.width - 70 && clickY <= 70);
                
                if (closeButtonArea) {
                    closeSidebar();
                    e.stopPropagation();
                }
            }
        });
    }
    
    // Close sidebar when clicking outside on mobile and tablet
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 991) {
            if (!sidebarEl?.contains(e.target) && !mobileMenuToggle?.contains(e.target)) {
                closeSidebar();
            }
        }
    });
    
    // Handle window resize with better responsive behavior
    window.addEventListener('resize', function() {
        const sidebar = document.getElementById('sidebar');
        const html = document.documentElement;
        const isRTL = html.getAttribute('dir') === 'rtl';
        
        if (window.innerWidth > 991) {
            // Desktop: Show sidebar and remove mobile/tablet active state
            if (sidebar) {
                sidebar.classList.remove('active');
                // Reset inline styles for desktop (let CSS take over)
                sidebar.style.transform = '';
                sidebar.style.width = '';
                sidebar.style.height = '';
                sidebar.style.top = '';
                sidebar.style.left = '';
                sidebar.style.right = '';
            }
            closeSidebar();
        } else {
            // Mobile/Tablet: Hide sidebar by default
            if (sidebar) {
                sidebar.classList.remove('active');
                // Remove inline styles to let mobile/tablet CSS take over
                sidebar.style.transform = '';
                sidebar.style.width = '';
                sidebar.style.height = '';
                sidebar.style.top = '';
                sidebar.style.left = '';
                sidebar.style.right = '';
            }
            closeSidebar();
        }
    });
    
    // Initialize responsive state with proper direction handling
    const sidebarElement = document.getElementById('sidebar');
    const html = document.documentElement;
    
    if (window.innerWidth <= 991) {
        // Mobile/Tablet: hide sidebar by default
        if (sidebarElement) {
            sidebarElement.classList.remove('active');
            // Let CSS handle the mobile/tablet styles
        }
        closeSidebar();
    } else {
        // Desktop: show sidebar
        if (sidebarElement) {
            sidebarElement.classList.remove('active');
            // Let CSS handle the desktop styles
        }
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    console.log('Toggle sidebar called', { sidebar, sidebarOverlay }); // Debug log
    
    if (sidebar && sidebarOverlay) {
        const isActive = sidebar.classList.contains('active');
        
        console.log('Sidebar active status:', isActive); // Debug log
        
        if (isActive) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }
}

function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    console.log('Opening sidebar...'); // Debug log
    console.log('Document direction:', document.documentElement.getAttribute('dir')); // Debug
    console.log('Sidebar element:', sidebar); // Debug
    
    sidebar?.classList.add('active');
    sidebarOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    console.log('Sidebar classes after open:', sidebar?.classList.toString()); // Debug log
    console.log('Sidebar computed style:', window.getComputedStyle(sidebar).transform); // Debug
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    sidebar?.classList.remove('active');
    sidebarOverlay?.classList.remove('active');
    document.body.style.overflow = '';
}

// Update page navigation active states
function updateActiveNavigation() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Update nav menu
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
    
    // Update sidebar
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// Initialize navigation states on page load
document.addEventListener('DOMContentLoaded', function() {
    updateActiveNavigation();
});

// Smooth scrolling for anchor links
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('#')) {
        e.preventDefault();
        const targetId = e.target.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
});

// Add loading animation for page transitions
function addPageTransition() {
    const links = document.querySelectorAll('a[href$=".html"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.hostname === window.location.hostname) {
                e.preventDefault();
                document.body.style.opacity = '0.7';
                
                setTimeout(() => {
                    window.location.href = this.href;
                }, 200);
            }
        });
    });
}

// Initialize page transitions
document.addEventListener('DOMContentLoaded', addPageTransition);

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Script loaded and DOM ready');
    
    initializeTheme();
    initializeLanguage();
    initializeNavigation();
    
    // Update active navigation
    updateActiveNavigation();
    
    // Initialize responsive layout
    console.log('Script loaded - initializing responsive layout');
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + D to toggle dark mode
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        document.getElementById('theme-toggle')?.click();
    }
    
    // Ctrl/Cmd + L to toggle language
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        document.getElementById('lang-toggle')?.click();
    }
    
    // Escape to close sidebar
    if (e.key === 'Escape') {
        closeSidebar();
    }
});