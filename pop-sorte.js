// POP-SORTE LOTTERY SYSTEM - FULL REVAMP
// Changes: WhatsApp instead of Pedido, UNLIMITED registrations per Game ID, proper Concurso system, no SN
let selectedNumbers = []; // Array to preserve order
const CONCURSO_REFERENCE = {
    number: 6903,
    date: new Date('2025-12-15T00:00:00-03:00') // Explicit Brazil time
};

// Helper to get current time in Brazil timezone
function getBrazilTime() {
    const now = new Date();
    // Use Intl.DateTimeFormat to get Brazil time components
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;
    // Create date in Brazil timezone explicitly
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
}

// Helper to format date/time in Brazil timezone
function formatBrazilDateTime(date, options = {}) {
    // Always format using Brazil timezone, regardless of user's local timezone
    return date.toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo', 
        ...options 
    });
}

// Helper to get YYYY-MM-DD in Brazil timezone
function getBrazilDateString(date) {
    // Use Intl.DateTimeFormat to get Brazil date components
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
}

// Draw calendar helpers (BRT)
function isNoDrawDay(date) {
    const month = date.getMonth(); // 0-indexed
    const day = date.getDate();
    const isChristmas = month === 11 && day === 25;
    const isNewYear = month === 0 && day === 1;
    return isChristmas || isNewYear;
}

function isEarlyDrawDay(date) {
    const month = date.getMonth();
    const day = date.getDate();
    return (month === 11 && (day === 24 || day === 31));
}

function getDrawTimeHour(date) {
    return isEarlyDrawDay(date) ? 17 : 20;
}

function isValidDrawDay(date) {
    const isSunday = date.getDay() === 0;
    return !isSunday && !isNoDrawDay(date);
}

function buildScheduleForDate(dateInput) {
    const dateStr = typeof dateInput === 'string'
        ? dateInput.split('T')[0]
        : getBrazilDateString(dateInput);

    const drawDate = new Date(`${dateStr}T00:00:00-03:00`);
    const drawHour = getDrawTimeHour(drawDate);

    const cutoff = new Date(`${dateStr}T${drawHour.toString().padStart(2, '0')}:00:00-03:00`);
    cutoff.setSeconds(cutoff.getSeconds() - 1); // 19:59:59 or 16:59:59

    const regStartDate = new Date(drawDate);
    regStartDate.setDate(regStartDate.getDate() - 1);
    const regStartStr = getBrazilDateString(regStartDate);
    const regStart = new Date(`${regStartStr}T20:00:01-03:00`); // 20:00:01 of previous day

    return { drawDate, drawHour, cutoff, regStart };
}

function getNextValidDrawDate(fromDate) {
    const probe = new Date(fromDate);
    probe.setHours(0, 0, 0, 0);

    for (let i = 0; i < 14; i++) {
        if (i > 0) probe.setDate(probe.getDate() + 1);
        if (isValidDrawDay(probe)) {
            return new Date(probe);
        }
    }
    throw new Error('No valid draw date found in range');
}

function getCurrentDrawSchedule() {
    const spNow = getBrazilTime(); // Use corrected Brazil time function
    const todayStr = getBrazilDateString(spNow);
    const today = new Date(`${todayStr}T00:00:00-03:00`);

    const todayValid = isValidDrawDay(today);
    if (todayValid) {
        const schedule = buildScheduleForDate(todayStr);
        if (spNow <= schedule.cutoff) {
            return { ...schedule, now: spNow };
        }
    }

    // After cutoff or today invalid: pick next valid draw day (skipping Sundays and blocked days)
    let probe = new Date(today);
    for (let i = 0; i < 14; i++) {
        probe.setDate(probe.getDate() + 1);
        const probeStr = getBrazilDateString(probe);
        const probeDate = new Date(`${probeStr}T00:00:00-03:00`);
        if (isValidDrawDay(probeDate)) {
            const nextSchedule = buildScheduleForDate(probeStr);
            return { ...nextSchedule, now: spNow };
        }
    }
    throw new Error('No valid draw date found');
}

// Calculate concurso number based on draw date while skipping non-draw days (Sundays + holiday closures)
function calculateConcurso(drawDate) {
    const refDateStr = getBrazilDateString(CONCURSO_REFERENCE.date);
    const targetDateStr = typeof drawDate === 'string'
        ? drawDate.split('T')[0]
        : getBrazilDateString(drawDate);

    const refDate = new Date(`${refDateStr}T12:00:00Z`);      // use noon UTC to avoid DST issues
    const targetDate = new Date(`${targetDateStr}T12:00:00Z`);

    let daysDiff = 0;
    let cursor = new Date(refDate);
    const step = targetDate >= refDate ? 1 : -1;

    while ((step === 1 && cursor < targetDate) || (step === -1 && cursor > targetDate)) {
        cursor.setUTCDate(cursor.getUTCDate() + step);
        const cursorStr = cursor.toISOString().split('T')[0];
        const cursorBrazil = new Date(`${cursorStr}T12:00:00-03:00`);
        if (isValidDrawDay(cursorBrazil)) {
            daysDiff += 1;
        }
    }

    return CONCURSO_REFERENCE.number + daysDiff * step;
}

// Get weekday name in Portuguese
function getWeekdayName(date) {
    const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    return days[date.getDay()];
}

// Initialize everything immediately (since script is at bottom of body)
generateNumberGrid();
updateSelectedDisplay();
updateSubmitButton();
initCountdown();
updateDrawDateDisplay();
updateConfirmationWarning();
setupGameIdInput();
setupWhatsappInput();
fetchAndPopulateResults();

// Fetch latest results, find winners, and update marquee
async function fetchAndPopulateResults() {
    const LOCAL_RESULTS_URL = 'resultado/data/results.json';
    const ENTRIES_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1OttNYHiecAuGG6IRX7lW6lkG5ciEcL8gp3g6lNrN9H8/export?format=csv&gid=0';
    const RESULTS_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1OttNYHiecAuGG6IRX7lW6lkG5ciEcL8gp3g6lNrN9H8/export?format=csv&gid=300277644';
    
    const marqueeBalls = document.getElementById('marqueeBalls');
    const marqueeContainer = document.querySelector('.results-marquee');
    const marqueeContent = document.getElementById('marqueeContent');
    
    if (!marqueeBalls || !marqueeContainer || !marqueeContent) return;

    const updateAndAnimate = (latestResult, winners = []) => {
        if (!marqueeBalls || !marqueeContent) return;
        
        marqueeBalls.innerHTML = '';
        
        // Destructure with fallbacks for local JSON format vs CSV format
        const nums = latestResult.numbers || [];
        const drawNumber = latestResult.drawNumber || latestResult.contest || '---';
        const dateStr = latestResult.date || '';
        
        // Format date for Brazil
        let formattedDate = '';
        if (dateStr) {
            try {
                // Try YYYY-MM-DD
                if (dateStr.includes('-')) {
                    const [y, m, d] = dateStr.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    formattedDate = dateObj.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                } else {
                    formattedDate = dateStr;
                }
            } catch (e) { formattedDate = dateStr; }
        }

        // Create/Update prefix
        let prefix = document.getElementById('marqueePrefix');
        if (!prefix) {
            prefix = document.createElement('span');
            prefix.id = 'marqueePrefix';
            marqueeBalls.parentNode.insertBefore(prefix, marqueeBalls);
        }
        prefix.innerHTML = `<span style="color:#ffffff;">ÚLTIMO RESULTADO: </span>`;

        // Remove any old suffix sibling (we will place it inside the flow)
        const oldSuffix = document.getElementById('marqueeSuffix');
        if (oldSuffix) oldSuffix.remove();

        // Add result balls
        if (nums && nums.length > 0) {
            nums.forEach(num => {
                const badge = document.createElement('div');
                badge.className = 'number-badge ' + getBallColorClass(num);
                const numberText = document.createElement('span');
                numberText.className = 'number-text';
                numberText.textContent = num.toString().padStart(2, '0');
                badge.appendChild(numberText);
                marqueeBalls.appendChild(badge);
            });
        }

        // Insert suffix right after numbers (before winners)
        if (drawNumber) {
            const suffixInside = document.createElement('span');
            suffixInside.id = 'marqueeSuffix';
            suffixInside.innerHTML = ` <span style="padding:2px 8px; border-radius:8px; font-weight:700; color:#ffffff; display:inline-flex; gap:6px; align-items:center;">
                <span style="color:#ffffff;">[ CONCURSO <b>#${drawNumber}</b></span>
                <span style="color:#ffffff;"> 📅 DATA: <b>${formattedDate}</b> ]</span>
               </span> `;
            marqueeBalls.appendChild(suffixInside);
        }

        // Add winners directly into marqueeBalls to ensure they are visible and looped
        if (winners && winners.length > 0) {
            const sep = document.createElement('span');
            sep.innerHTML = ' 🏆 ';
            sep.style.margin = '0 10px';
            sep.style.fontWeight = 'bold';
            marqueeBalls.appendChild(sep);

            const winnersTitle = document.createElement('span');
            winnersTitle.innerHTML = '<b>GANHADOR(ES):</b> ';
            winnersTitle.style.color = '#ffffff';
            winnersTitle.style.marginRight = '8px';
            marqueeBalls.appendChild(winnersTitle);

            winners.forEach((win) => {
                const winTag = document.createElement('span');
                winTag.className = 'winner-info';
                winTag.style.display = 'inline-flex';
                winTag.style.alignItems = 'center';
                winTag.style.gap = '6px';
                winTag.style.background = 'rgba(255, 255, 255, 0.1)';
                winTag.style.animation = 'pulseWinner 1.2s ease-in-out infinite';
                winTag.style.padding = '3px 10px';
                winTag.style.borderRadius = '8px';
                winTag.style.border = '2px solid rgba(255, 255, 255, 0.3)';
                winTag.style.fontSize = '0.85rem';
                winTag.style.marginRight = '12px';
                winTag.style.color = '#ffffff';
                winTag.style.cursor = 'pointer';
                winTag.title = 'Clique para ver detalhes do ganhador';

                const gameIdShort = win.gameId;
                const winDate = (win.drawDate || '').split(' ')[0];
                
                // Construct inner HTML with Game ID and Date
                let innerHTML = `<span style="font-weight:800; color:#ffffff;">ID: ${gameIdShort}</span> ` +
                               `<span style="opacity:0.9; font-size:0.75rem; color:#ffffff;">(${winDate})</span> ` +
                               `<span style="color:#ffffff; font-weight:700;">[</span>`;
                
                // Add numbers with conditional ball badge styling
                win.chosenNumbers.forEach((num, idx) => {
                    const isMatch = nums.includes(num);
                    if (isMatch) {
                        innerHTML += `<div class="number-badge ${getBallColorClass(num)}" style="width:22px; height:22px; font-size:0.65rem; margin:0 2px;">` +
                                     `<span class="number-text">${num.toString().padStart(2, '0')}</span>` +
                                     `</div>`;
                    } else {
                        innerHTML += `<span style="margin:0 2px; color:#ffffff;">${num.toString().padStart(2, '0')}</span>`;
                    }
                    
                    if (idx < win.chosenNumbers.length - 1) {
                        innerHTML += `<span style="opacity:0.7; color:#ffffff;">,</span>`;
                    }
                });
                
                innerHTML += `<span style="color:#ffffff; font-weight:700;">]</span>`;
                winTag.innerHTML = innerHTML;
                
                // Add click event to scroll to winners carousel section
                winTag.addEventListener('click', () => {
                    const carouselSection = document.getElementById('winnersCarouselSection');
                    if (carouselSection) {
                        carouselSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
                
                marqueeBalls.appendChild(winTag);
            });
        }

        // UPDATE WINNERS CAROUSEL
        updateWinnersCarousel(winners, nums);

        startMarquee();
    };

    const updateWinnersCarousel = (winners, winningNums) => {
        const carouselSection = document.getElementById('winnersCarouselSection');
        const track = document.getElementById('winnersCarouselTrack');
        const dotsContainer = document.getElementById('carouselDots');
        
        if (!carouselSection || !track || !dotsContainer) return;

        if (!winners || winners.length === 0) {
            carouselSection.style.display = 'none';
            return;
        }

        carouselSection.style.display = 'block';
        track.innerHTML = '';
        dotsContainer.innerHTML = '';

        winners.forEach((win, index) => {
            const card = document.createElement('div');
            card.className = 'winner-card';
            
            const winDate = (win.drawDate || '').split(' ')[0];
            
            let numsHTML = '';
            win.chosenNumbers.forEach(num => {
                const isMatch = winningNums.includes(num);
                if (isMatch) {
                    numsHTML += `<div class="winner-num-item match number-badge ${getBallColorClass(num)}">` +
                                `<span class="number-text">${num.toString().padStart(2, '0')}</span></div>`;
                } else {
                    numsHTML += `<div class="winner-num-item">${num.toString().padStart(2, '0')}</div>`;
                }
            });

            card.innerHTML = `
                <div class="winner-card-header">
                    <div class="winner-badge-pill">🏆 </div>
                    <span style="color: #64748b; font-size: 0.85rem; font-weight: 600;">SORTEIO: ${winDate}</span>
                </div>
                <div class="winner-id-text">ID: <strong>${win.gameId}</strong></div>
                <div class="winner-numbers-display">
                    ${numsHTML}
                </div>
                <div style="font-size: 0.85rem; color: #10b981; font-weight: 800;">
                    ${win.matches} ACERTOS! PARABÉNS! 🎉
                </div>
            `;
            track.appendChild(card);

            // Add dots
            const dot = document.createElement('div');
            dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
            dot.onclick = () => goToSlide(index);
            dotsContainer.appendChild(dot);
        });

        // Initialize Carousel
        let currentSlide = 0;
        const totalSlides = winners.length;
        
        function goToSlide(n) {
            currentSlide = n;
            track.style.transform = `translateX(-${n * 100}%)`;
            
            // Update dots
            const dots = dotsContainer.querySelectorAll('.carousel-dot');
            dots.forEach((dot, idx) => {
                dot.classList.toggle('active', idx === n);
            });
        }

        // Auto-slide if more than 1 winner
        if (totalSlides > 1) {
            if (window.winnersCarouselInterval) clearInterval(window.winnersCarouselInterval);
            window.winnersCarouselInterval = setInterval(() => {
                currentSlide = (currentSlide + 1) % totalSlides;
                goToSlide(currentSlide);
            }, 5000);
        }
    };

    const startMarquee = () => {
        if (!marqueeContainer || !marqueeContent) return;

        // RE-SYNC ANIMATION
        const existingClones = marqueeContainer.querySelectorAll('.marquee-content:not([id="marqueeContent"])');
        existingClones.forEach(el => el.remove());
        
        marqueeContent.classList.remove('is-animating');
        
        const clone = marqueeContent.cloneNode(true);
        clone.id = ""; 
        clone.classList.remove('is-animating'); 
        clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        marqueeContainer.appendChild(clone);

        void marqueeContent.offsetWidth;
        void clone.offsetWidth;

        marqueeContent.classList.add('is-animating');
        clone.classList.add('is-animating');
    };

    try {
        // 1. Fetch Results
        let latestResult = null;
        try {
            const res = await fetch(`${LOCAL_RESULTS_URL}?t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) latestResult = data.results[0];
            }
        } catch (e) { console.warn('Local results fetch failed'); }

        if (!latestResult) {
            const res = await fetch(RESULTS_SHEET_CSV_URL);
            if (res.ok) {
                const csv = await res.text();
                const lines = csv.split('\n').filter(Boolean);
                if (lines.length > 1) {
                    const lastLine = lines[lines.length - 1];
                    const row = parseCSVLine(lastLine);
                    if (row.length >= 7) {
                        const nums = row.slice(2, 7).map(v => parseInt(v, 10)).filter(n => !isNaN(n));
                        const dateParts = (row[1] || '').split('/');
                        const dateISO = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}` : new Date().toISOString().split('T')[0];
                        latestResult = {
                            drawNumber: row[0],
                            date: dateISO,
                            numbers: nums
                        };
                    }
                }
            }
        }

        if (!latestResult) throw new Error('Could not fetch results');

        // 2. Fetch Entries and Find Winners
        let winners = [];
        try {
            const res = await fetch(ENTRIES_SHEET_CSV_URL);
            if (res.ok) {
                const csv = await res.text();
                const lines = csv.split('\n').filter(Boolean);
                const allEntries = [];
                for (let i = 1; i < lines.length; i++) {
                    const row = parseCSVLine(lines[i]);
                    if (row.length >= 8) {
                        allEntries.push({
                            gameId: row[1],
                            chosenNumbers: (row[3] || '').split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)),
                            drawDate: row[4],
                            contest: String(row[5] || '').trim(),
                            status: String(row[7] || '').trim().toUpperCase()
                        });
                    }
                }

                // Filter winners for the latest contest (3+ matches) AND MUST BE VALID
                if (allEntries.length > 0) {
                    const winNums = latestResult.numbers || [];
                    const targetContest = String(latestResult.drawNumber || latestResult.contest || '').trim().replace('#', '');
                    
                    console.log(`Checking winners for contest ${targetContest} against numbers:`, winNums);

                    const possibleWinners = allEntries.filter(e => {
                        const entryContest = String(e.contest || '').trim().replace('#', '');
                        const isContestMatch = entryContest === targetContest;
                        const isValidStatus = e.status === 'VALID' || e.status === 'VALIDADO';
                        return isContestMatch && isValidStatus;
                    });
                    
                    console.log(`Found ${possibleWinners.length} VALID entries for contest ${targetContest}`);
                    
                    const calculatedWinners = possibleWinners.map(e => {
                        const matches = e.chosenNumbers.filter(n => winNums.includes(n)).length;
                        return { ...e, matches };
                    }).filter(e => e.matches >= 3);

                    console.log(`Found ${calculatedWinners.length} winners with 3+ matches`);

                    // Sort by matches desc and take top 5
                    winners = calculatedWinners.sort((a, b) => b.matches - a.matches).slice(0, 5);
                }
            }
        } catch (e) { console.warn('Entries fetch failed', e); }

        updateAndAnimate(latestResult, winners);

    } catch (error) {
        console.error('All results sources failed:', error);
        marqueeBalls.innerHTML = '<span style="color: #64748b;">Resultados indisponíveis no momento</span>';
        startMarquee();
    }
}

// Simple CSV line parser
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else current += ch;
    }
    values.push(current.trim());
    return values;
}

// GAME ID VALIDATION - EXACTLY 10 DIGITS
const GAME_ID_REGEX = /^[0-9]{10}$/;

function isValidGameId(id) {
    return typeof id === 'string' && GAME_ID_REGEX.test(id);
}

function normalizeGameId(id) {
    if (!isValidGameId(id)) {
        throw new Error('ID de Jogo deve ter exatamente 10 dígitos');
    }
    return id;
}

// WHATSAPP BRAZIL VALIDATION - 10 or 11 DIGITS
const WHATSAPP_REGEX = /^[0-9]{10,11}$/;

function isValidWhatsApp(number) {
    return typeof number === 'string' && WHATSAPP_REGEX.test(number);
}

// Setup Game ID input with exactly 10 digit validation
function setupGameIdInput() {
    const gameIdInput = document.getElementById('gameId');
    
    gameIdInput.addEventListener('input', function(e) {
        // Remove all non-digit characters
        let value = e.target.value.replace(/\D/g, '');
        
        // Limit to exactly 10 digits
        if (value.length > 10) {
            value = value.slice(0, 10);
        }
        
        e.target.value = value;
        
        // Visual feedback
        if (value.length === 10) {
            e.target.style.borderColor = '#22c55e';
        } else {
            e.target.style.borderColor = '#e5e7eb';
        }
    });
}

// Setup WhatsApp input with Brazil format validation
function setupWhatsappInput() {
    const whatsappInput = document.getElementById('whatsappNumber');
    
    whatsappInput.addEventListener('input', function(e) {
        // Remove all non-digit characters
        let value = e.target.value.replace(/\D/g, '');
        
        // Limit to 11 digits (Brazil mobile: 11 99988 7766)
        if (value.length > 11) {
            value = value.slice(0, 11);
        }
        
        // Format for Brazil: XX XXXXX XXXX or XX XXXX XXXX
        let formatted = value;
        if (value.length > 2) {
            formatted = value.slice(0, 2) + ' ' + value.slice(2);
        }
        if (value.length > 7) {
            formatted = value.slice(0, 2) + ' ' + value.slice(2, 7) + ' ' + value.slice(7);
        }
        
        e.target.value = formatted;
        
        // Visual feedback (10-11 digits valid)
        const raw = value;
        if (raw.length >= 10 && raw.length <= 11) {
            e.target.style.borderColor = '#22c55e';
        } else {
            e.target.style.borderColor = '#e5e7eb';
        }
    });
    
    // Store raw value in data attribute for submission
    whatsappInput.addEventListener('blur', function(e) {
        const raw = e.target.value.replace(/\D/g, '');
        e.target.dataset.raw = raw;
    });
}

// Toggle WhatsApp field visibility (opt-out logic)
function toggleWhatsappField() {
    const checkbox = document.getElementById('whatsappOptOut');
    const whatsappGroup = document.getElementById('whatsappGroup');
    const whatsappInput = document.getElementById('whatsappNumber');

    // Checkbox is optional in the current markup; default to showing WhatsApp field
    if (!checkbox) {
        whatsappGroup.style.display = 'block';
        whatsappInput.required = true;
        return;
    }

    if (checkbox.checked) {
        // User doesn't want to provide WhatsApp - hide field
        whatsappGroup.style.display = 'none';
        whatsappInput.required = false;
        whatsappInput.value = '';
    } else {
        // Show WhatsApp field (default)
        whatsappGroup.style.display = 'block';
        whatsappInput.required = true;
    }
}

// Generate 80 numbers
function generateNumberGrid() {
    const grid = document.getElementById('numberGrid');
    grid.innerHTML = '';
    
    for (let i = 1; i <= 80; i++) {
        const ball = document.createElement('div');
        ball.className = 'number-ball';
        ball.textContent = i.toString().padStart(2, '0');
        ball.dataset.number = i;
        ball.onclick = () => toggleNumber(i);
        grid.appendChild(ball);
    }
}

// Toggle number selection - ALWAYS SORTED
function toggleNumber(num) {
    const ball = document.querySelector(`.number-ball[data-number="${num}"]`);
    const maxNumbers = 5;
    
    const index = selectedNumbers.indexOf(num);
    
    if (index > -1) {
        selectedNumbers.splice(index, 1);
        ball.classList.remove('selected');
    } else {
        if (selectedNumbers.length < maxNumbers) {
            selectedNumbers.push(num);
            ball.classList.add('selected');
        } else {
            showToast('MÁXIMO 5 NÚMEROS!');
        }
    }
    
    // Sort numbers from smallest to largest
    selectedNumbers.sort((a, b) => a - b);
    
    updateSelectedDisplay();
    updateSubmitButton();
}

// Calculate ball color class based on grid position (matches CSS nth-child(10n+x) pattern)
function getBallColorClass(num) {
    const remainder = num % 10;
    return `ball-color-${remainder}`;
}

// Update display - SHOWS SELECTED NUMBERS WITHOUT ORDER INDICATORS
function updateSelectedDisplay() {
    const container = document.getElementById('selectedNumbers');
    const countDisplay = document.getElementById('selectedCount');
    
    container.innerHTML = '';
    
    if (selectedNumbers.length === 0) {
        container.innerHTML = '<span class="empty-state">Nenhum número selecionado</span>';
    } else {
        selectedNumbers.forEach((num) => {
            const badge = document.createElement('div');
            badge.className = 'number-badge ' + getBallColorClass(num);
            
            const numberText = document.createElement('span');
            numberText.className = 'number-text';
            numberText.textContent = num.toString().padStart(2, '0');
            
            badge.appendChild(numberText);
            container.appendChild(badge);
        });
    }
    
    countDisplay.textContent = `${selectedNumbers.length}/5 números`;
    countDisplay.className = 'selected-count';
    
    if (selectedNumbers.length >= 5 && selectedNumbers.length <= 20) {
        countDisplay.classList.add('complete');
    }
}

// Clear numbers
function clearNumbers() {
    selectedNumbers = [];
    document.querySelectorAll('.number-ball.selected').forEach(ball => {
        ball.classList.remove('selected');
    });
    updateSelectedDisplay();
    updateSubmitButton();
}

// Surpresinha - random EXACTLY 5 numbers with sorting
function surpresinha() {
    clearNumbers();
    
    const quantity = 5;
    const numbers = [];
    
    for (let i = 1; i <= 80; i++) {
        numbers.push(i);
    }
    
    // Shuffle using Fisher-Yates algorithm
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    // Select first 5 numbers and SORT them
    const selectedRandom = numbers.slice(0, quantity).sort((a, b) => a - b);
    
    selectedRandom.forEach(num => {
        selectedNumbers.push(num);
        const ball = document.querySelector(`.number-ball[data-number="${num}"]`);
        ball.classList.add('selected');
    });
    
    // Ensure selectedNumbers is sorted
    selectedNumbers.sort((a, b) => a - b);
    
    updateSelectedDisplay();
    updateSubmitButton();
    
    // Show selected numbers in toast
    const displayNumbers = selectedNumbers.map(n => n.toString().padStart(2, '0')).join(', ');
    showToast(`🎲 ${displayNumbers}`);
}

// Update submit button
function updateSubmitButton() {
    const btn = document.getElementById('submitBtn');
    
    if (selectedNumbers.length >= 5 && selectedNumbers.length <= 20) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
}

// Show user info popup
function showUserInfoPopup() {
    if (selectedNumbers.length < 5 || selectedNumbers.length > 20) {
        showToast('SELECIONE ENTRE 5 NÚMEROS!');
        return;
    }
    
    updateConfirmationWarning(); // Update warning with current concurso info
    document.getElementById('userInfoPopup').style.display = 'block';
}

// Update confirmation warning text
function updateConfirmationWarning() {
    const drawDate = getDrawDate();
    const drawHour = getDrawHour();
    const concurso = calculateConcurso(drawDate);
    const weekday = getWeekdayName(drawDate);
    const formattedDate = formatBrazilDateTime(drawDate, {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
    
    const warningText = `Está prestes a se cadastrar no <strong>CONCURSO ${concurso}</strong> (${weekday} <strong>${formattedDate}</strong>) às <strong>${drawHour.toString().padStart(2, '0')}:00</strong> BRT.<br><br>
    Resultado será atualizado no oficial: <a href="https://loterias.caixa.gov.br/Paginas/quina.aspx" target="_blank" style="color: #0b3eccff; text-decoration: underline;">https://loterias.caixa.gov.br/Paginas/quina.aspx</a>.`;
    
    const warningElement = document.getElementById('confirmationWarning');
    if (warningElement) {
        warningElement.innerHTML = warningText;
    }
}

// Close popup
function closeUserInfoPopup() {
    document.getElementById('userInfoPopup').style.display = 'none';
    document.getElementById('gameId').value = '';
    document.getElementById('whatsappNumber').value = '';
    const optOut = document.getElementById('whatsappOptOut');
    if (optOut) {
        optOut.checked = false;
        toggleWhatsappField();
    }
}

// Calculate draw date/time with holiday and early-draw rules (BRT)
function getDrawDate() {
    const schedule = getCurrentDrawSchedule();
    return schedule.drawDate;
}

function getDrawHour() {
    const schedule = getCurrentDrawSchedule();
    return schedule.drawHour;
}

// Get cutoff period identifier
function getCutoffPeriod() {
    const drawDate = getDrawDate();
    return drawDate.toISOString().split('T')[0];
}

// CONFIRM ENTRY - NEW FLOW: Optional WhatsApp, no SN, UNLIMITED registrations per Game ID
async function confirmEntry() {
    const gameIdRaw = document.getElementById('gameId').value.trim();
    const whatsappOptOut = document.getElementById('whatsappOptOut');
    const whatsappInput = document.getElementById('whatsappNumber');
    
    // Validate Game ID - EXACTLY 10 digits
    let gameId;
    try {
        gameId = normalizeGameId(gameIdRaw);
    } catch (error) {
        showToast('❌ ID DE JOGO INVÁLIDO! Digite exatamente 10 dígitos', 'error');
        return;
    }
    
    // Get WhatsApp number - clean format +55XXXXXXXXXXX (no spaces)
    let whatsappNumber = 'N/A';
    const isOptOutChecked = whatsappOptOut ? whatsappOptOut.checked : false;
    if (!isOptOutChecked) {
        // User wants to provide WhatsApp
        const rawNumber = whatsappInput.value.replace(/\D/g, '');
        
        if (!isValidWhatsApp(rawNumber)) {
            showToast('❌ WHATSAPP INVÁLIDO! Digite 10-11 dígitos (ex: 11999887766)', 'error');
            return;
        }
        
        // Format as +55XXXXXXXXXXX
        whatsappNumber = '+55' + rawNumber;
    }
    
    if (selectedNumbers.length < 5 || selectedNumbers.length > 20) {
        showToast('❌ SELECIONE ENTRE 5 NÚMEROS!', 'error');
        return;
    }
    
    console.log('══════════════════════════════════════');
    console.log('🎯 STARTING ENTRY VALIDATION');
    console.log('   Game ID:', gameId);
    console.log('   WhatsApp:', whatsappNumber);
    console.log('   Numbers:', selectedNumbers);
    console.log('══════════════════════════════════════');
    
    closeUserInfoPopup();
    showToast('🔍 VERIFICANDO...', 'checking');
    
    try {
        const drawDate = getDrawDate();
        const numerosFormatted = selectedNumbers.map(n => n.toString().padStart(2, '0')).join(', ');
        
        console.log('Draw date calculated:', drawDate);
        
        // ATOMIC SAVE - Backend handles bilhete numbering (1º, 2º, 3º, etc per Game ID per period)
        const saveResult = await saveToGoogleSheet(gameId, whatsappNumber, numerosFormatted, drawDate);
        
        if (!saveResult.success) {
            throw new Error(saveResult.error || 'Erro ao salvar');
        }
        
        const bilheteNumber = saveResult.bilheteNumber;
        
        console.log(`✅ SAVED! Bilhete number: ${bilheteNumber}`);
        
        // Send to Telegram
        hideToast();
        showToast('📱 ENVIANDO...', 'checking');
        
        try {
            await sendToTelegram(gameId, whatsappNumber, numerosFormatted, drawDate, bilheteNumber);
        } catch (err) {
            console.warn('Telegram failed:', err);
        }
        
        // Redirect to bilhete page
        const spTime = getBrazilTime();
        
        const generateTime = formatBrazilDateTime(spTime, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const ticketDateDisplay = formatBrazilDateTime(drawDate, {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        const formattedNumbers = selectedNumbers.map(n => n.toString().padStart(2, '0')).join(',');
        
        const concurso = calculateConcurso(drawDate);
        
        const params = new URLSearchParams({
            gameId: gameId,
            whatsapp: whatsappNumber,
            numbers: formattedNumbers,
            time: generateTime,
            date: ticketDateDisplay,
            bilhete: bilheteNumber,
            concurso: concurso
        });
        
        hideToast();
        window.location.href = `bilhete.html?${params.toString()}`;
        
    } catch (error) {
        console.error('Error:', error);
        hideToast();
        
        // Show actual error message from server or network error
        const errorMsg = error.message || 'Erro ao salvar! Tente novamente!';
        showToast('❌ ' + errorMsg, 'error');
    }
}

// Send to Telegram
async function sendToTelegram(gameId, whatsappNumber, numeros, drawDate, bilheteNumber) {
    const botToken = '8587095310:AAFVoP_FgWwwEicABHs5n6ic1qKukB0dxNc';
    const chatId = '-1003670639333';
    
    const drawDateStr = formatBrazilDateTime(drawDate, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    const drawHour = getDrawHour();
    const concurso = calculateConcurso(drawDate);
    
    const message = `
🎫 <b>POP-SORTE</b>

👤 <b>Game ID:</b> ${gameId}
📱 <b>WhatsApp:</b> ${whatsappNumber}

🎰 <b>Concurso:</b> ${concurso} | 🎟️ ${bilheteNumber}º bilhete
🎯 <b>Números:</b> ${numeros}
📅 <b>Sorteio:</b> ${drawDateStr} às ${drawHour.toString().padStart(2, '0')}:00 (BRT)

🕒 <b>Registro:</b> ${formatBrazilDateTime(new Date())}
    `.trim();
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        })
    });
    
    if (!response.ok) {
        throw new Error('Telegram failed');
    }
    
    return response.json();
}

// Save to Google Sheet - NO SN, WhatsApp, UNLIMITED bilhetes per Game ID
async function saveToGoogleSheet(gameId, whatsappNumber, numeros, drawDate) {
    const webAppUrl = 'https://script.google.com/macros/s/AKfycbwFobCfu1MhqjuCfSW2Rx5IwCfgaZZ4raDoMOcbjhJtF1oZtWk3r-i_ZrDfY494kKj9/exec';
    
    // Format date WITHOUT timezone conversion (YYYY-MM-DD)
    const year = drawDate.getFullYear();
    const month = String(drawDate.getMonth() + 1).padStart(2, '0');
    const day = String(drawDate.getDate()).padStart(2, '0');
    const drawDateStr = `${year}-${month}-${day}`;
    
    const concurso = calculateConcurso(drawDate);
    
    console.log('═══════════════════════════════════');
    console.log('💾 SAVING TO GOOGLE SHEET');
    console.log('   Game ID:', gameId);
    console.log('   WhatsApp:', whatsappNumber);
    console.log('   Numbers:', numeros);
    console.log('   Draw Date:', drawDateStr);
    console.log('   Concurso:', concurso);
    console.log('═══════════════════════════════════');
    
    const params = new URLSearchParams({
        action: 'saveAndGetBilhete',
        gameId: gameId,
        whatsappNumber: whatsappNumber,
        numerosEscolhidos: numeros,
        drawDate: drawDateStr,
        concurso: concurso
    });
    
    const fullUrl = `${webAppUrl}?${params.toString()}`;
    console.log('📤 Save URL:', fullUrl);
    
    const response = await fetch(fullUrl, {
        method: 'GET'
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Response from server:', data);
    
    // Check if server returned error
    if (!data.success) {
        const errorMsg = data.error || 'Erro desconhecido do servidor';
        throw new Error(errorMsg);
    }
    
    // Check if bilhete number is missing
    if (!data.bilheteNumber) {
        throw new Error('Servidor não retornou número do bilhete');
    }
    
    return {
        success: true,
        bilheteNumber: data.bilheteNumber,
        count: data.count
    };
}

// Toast notification
function showToast(message, type = 'default') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';
    
    if (type === 'error') {
        toast.classList.add('error');
        setTimeout(() => {
            toast.className = 'toast';
        }, 15000);
    } else if (type === 'checking') {
        toast.classList.add('checking');
    } else {
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }
}

// Hide toast manually
function hideToast() {
    const toast = document.getElementById('toast');
    toast.className = 'toast';
}

// Countdown timer - BRAZIL TIMEZONE + SKIP SUNDAY
// ✅ CORRECT - Force Brazil timezone
function initCountdown() {
    function updateCountdown() {
        const spTime = getBrazilTime(); // Use corrected Brazil time function
        
        const schedule = getCurrentDrawSchedule();
        
        // Build target time with explicit Brazil timezone
        const drawDateStr = getBrazilDateString(schedule.drawDate);
        const targetTime = new Date(`${drawDateStr}T${schedule.drawHour.toString().padStart(2, '0')}:00:00-03:00`);
        
        const diff = targetTime - spTime;
        
        if (diff < 0) {
            console.warn('Countdown negative, recalculating...');
            // Force page reload to recalculate next draw
            setTimeout(() => {
                initCountdown(); // Restart countdown
            }, 1000);
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
            countdownEl.textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            const minutesLeft = Math.floor(diff / (1000 * 60));
            if (minutesLeft <= 15) {
                countdownEl.classList.add('pulse');
            } else {
                countdownEl.classList.remove('pulse');
            }
        }
    }
    
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Scroll to selection
function scrollToSelection() {
    document.getElementById('selection').scrollIntoView({ behavior: 'smooth' });
}

// Scroll to vertical video section
function scrollToVerticalVideo() {
    const target = document.getElementById('verticalVideoSection');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
    }
}

// Update draw date display with CONCURSO NUMBER
function updateDrawDateDisplay() {
    const drawDate = getDrawDate();
    const drawHour = getDrawHour();
    const concurso = calculateConcurso(drawDate);
    
    const day = drawDate.getDate().toString().padStart(2, '0');
    const month = (drawDate.getMonth() + 1).toString().padStart(2, '0');
    const year = drawDate.getFullYear();
    
    const formattedDate = `${day}/${month}/${year} ${drawHour.toString().padStart(2, '0')}h`;
    
    document.getElementById('drawDate').textContent = formattedDate;
    document.getElementById('contestNumber').textContent = concurso;
}
