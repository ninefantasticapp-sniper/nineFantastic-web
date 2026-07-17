// ============================================================
// sw.js — Service Worker untuk IXF Kelas 9
// Fitur: Notifikasi latar belakang dengan periodic sync
// ============================================================

// ===== DATA JADWAL (copy dari main page) =====
const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const SCHEDULE_DATA = {
    'Senin': [
        { jam: [2, 3, 4], mapel: 'Ilmu Pengetahuan Sosial', guru: 'Pak Ali' },
        { jam: [5], mapel: 'Pendidikan Agama Islam dan Budi Pekerti', guru: 'Pak Misbah' },
        { jam: [6, 7], mapel: 'Matematika', guru: 'Bu Elok' }
    ],
    'Selasa': [
        { jam: [1], mapel: 'Bahasa Daerah', guru: 'Bu Ika' },
        { jam: [2, 3], mapel: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', guru: 'Pak Yon' },
        { jam: [4, 5], mapel: 'Ilmu Pengetahuan Alam', guru: 'Pak Sohibi' },
        { jam: [6, 7], mapel: 'Pendidikan Pancasila dan Kewarganegaraan', guru: 'Bu Yanik' }
    ],
    'Rabu': [
        { jam: [1, 2], mapel: 'Pendidikan Agama Islam dan Budi Pekerti', guru: 'Pak Misbah' },
        { jam: [3, 4, 5], mapel: 'Prakarya', guru: 'Bu Yunita' },
        { jam: [6, 7], mapel: 'Bahasa Inggris', guru: 'Pak Agus' }
    ],
    'Kamis': [
        { jam: [2, 3], mapel: 'Bahasa Indonesia', guru: 'Pak Umar' },
        { jam: [4, 5], mapel: 'Informatika / Teknologi Informasi dan Komunikasi', guru: 'Bu Alfi' },
        { jam: [6, 7], mapel: 'Ilmu Pengetahuan Alam', guru: 'Pak Sohibi' }
    ],
    'Jumat': [
        { jam: [], mapel: 'kokulikuler', guru: '' }
    ],
    'Sabtu': [
        { jam: [1, 2], mapel: 'Matematika', guru: 'Bu Elok' },
        { jam: [3, 4, 5], mapel: 'Bahasa Indonesia', guru: 'Pak Umar' }
    ]
};

// ===== INDEXEDDB HELPER =====
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('IXF_NotifDB', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getSetting(key) {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction('settings', 'readonly');
            const store = tx.objectStore('settings');
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => resolve(null);
        });
    } catch { return null; }
}

async function setSetting(key, value) {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');
            store.put({ id: key, value: value });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch { return false; }
}

// ===== FUNGSI JADWAL =====
function getTodayIndex() {
    const d = new Date();
    let idx = d.getDay() - 1;
    if (idx < 0) idx = 6;
    return idx;
}

function isTomorrowSunday() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow.getDay() === 0;
}

function getMapelListForDay(dayName) {
    const lessons = SCHEDULE_DATA[dayName] || [];
    if (dayName === 'Jumat') {
        const p5 = lessons[0];
        return p5 ? [p5.mapel] : ['P5'];
    }
    return lessons.map(l => l.mapel);
}

// ===== GENERATE PESAN NOTIFIKASI =====
function generateNotificationMessage(userName) {
    if (isTomorrowSunday()) {
        return {
            title: '📚 IXF - Libur Minggu',
            body: `Hai ${userName || 'Teman'}, selamat berlibur ya, istirahat terlebih dahulu agar Senin besok semangat buat belajar lagi di 9F ♥️`
        };
    }

    const todayIdx = getTodayIndex();
    let tomorrowIdx = todayIdx + 1;
    let tomorrowName;
    if (tomorrowIdx > 5) {
        tomorrowName = 'Minggu';
    } else {
        tomorrowName = DAY_NAMES[tomorrowIdx];
    }

    if (tomorrowName === 'Minggu') {
        return {
            title: '📚 IXF - Libur Minggu',
            body: `Hai ${userName || 'Teman'}, selamat berlibur ya, istirahat terlebih dahulu agar Senin besok semangat buat belajar lagi di 9F ♥️`
        };
    }

    const mapels = getMapelListForDay(tomorrowName);
    const listMapel = mapels.length > 0 ? mapels.join(', ') : 'Tidak ada pelajaran';
    return {
        title: '📚 IXF - Pengingat Jadwal',
        body: `Hai ${userName || 'Teman'}, udah siap buat menyambut pelajaran baru besok? 📖\n${listMapel}`
    };
}

// ===== CEK DAN KIRIM NOTIFIKASI =====
async function checkAndSendNotification() {
    try {
        const notifTime = await getSetting('notif_time');
        if (!notifTime) return;

        const now = new Date();
        const nowStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        if (nowStr === notifTime) {
            const todayStr = now.toDateString();
            const lastSent = await getSetting('last_notif_date');

            if (lastSent !== todayStr) {
                const userName = await getSetting('user_name') || 'Teman';
                const msg = generateNotificationMessage(userName);

                // Tampilkan notifikasi
                await self.registration.showNotification(msg.title, {
                    body: msg.body,
                    icon: 'logokelas.png',
                    tag: 'ixf-schedule-reminder',
                    requireInteraction: true,
                    vibrate: [200, 100, 200],
                    data: { url: self.location.origin }
                });

                await setSetting('last_notif_date', todayStr);
                console.log('✅ [SW] Notifikasi dikirim pada', nowStr);
            }
        }
    } catch (err) {
        console.warn('⚠️ [SW] Gagal cek notifikasi:', err);
    }
}

// ============================================================
// EVENT LISTENER SERVICE WORKER
// ============================================================

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
    console.log('✅ [SW] Service Worker terinstal');
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    console.log('✅ [SW] Service Worker diaktifkan');

    // Cek notifikasi saat aktif
    event.waitUntil(checkAndSendNotification());
});

// ===== PERIODIC SYNC =====
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'ixf-schedule-check') {
        event.waitUntil(checkAndSendNotification());
        console.log('🔄 [SW] Periodic sync dijalankan');
    }
});

// ===== PESAN DARI MAIN PAGE =====
self.addEventListener('message', async (event) => {
    const msg = event.data;
    console.log('📨 [SW] Pesan diterima:', msg);

    if (msg.type === 'SET_NOTIF_TIME') {
        await setSetting('notif_time', msg.time);
        if (msg.userName) {
            await setSetting('user_name', msg.userName);
        }
        console.log('✅ [SW] Waktu notifikasi disimpan:', msg.time);
    }

    if (msg.type === 'SET_NAME') {
        await setSetting('user_name', msg.name);
        console.log('✅ [SW] Nama pengguna disimpan:', msg.name);
    }

    if (msg.type === 'SET_SCHEDULE_DATA') {
        // Data jadwal sudah ada di SW, tidak perlu disimpan lagi
        console.log('✅ [SW] Data jadwal diterima');
    }

    if (msg.type === 'DEACTIVATE_NOTIF') {
        await setSetting('notif_time', null);
        await setSetting('last_notif_date', null);
        console.log('✅ [SW] Notifikasi dinonaktifkan');
    }

    if (msg.type === 'PERMISSION_GRANTED') {
        console.log('✅ [SW] Izin notifikasi diberikan');
        // Cek notifikasi saat izin diberikan
        await checkAndSendNotification();
    }

    if (msg.type === 'SHOW_NOTIFICATION') {
        // Tampilkan notifikasi dari main page
        try {
            await self.registration.showNotification(msg.title, {
                body: msg.body,
                icon: msg.icon || 'logokelas.png',
                tag: 'ixf-schedule-reminder',
                requireInteraction: true,
                vibrate: [200, 100, 200],
                data: { url: self.location.origin }
            });
            console.log('✅ [SW] Notifikasi ditampilkan dari pesan:', msg.title);
        } catch (err) {
            console.warn('⚠️ [SW] Gagal tampilkan notifikasi:', err);
        }
    }
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || self.location.origin;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
            for (let client of windowClients) {
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

console.log('✅ [SW] Service Worker IXF siap!');