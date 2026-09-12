/**
 * ============================================================
 * APP.JS — Aplikasi Wali Kelas (Frontend)
 * Dihosting terpisah dari backend (mis. GitHub Pages), berkomunikasi
 * dengan backend Google Apps Script murni lewat HTTP (fetch), BUKAN
 * lewat google.script.run.
 *
 * SEBELUM DIPAKAI: isi konstanta API_URL di bagian "BAGIAN: INTI
 * APLIKASI" di bawah dengan URL Web App Apps Script Anda (didapat
 * setelah Deploy > New deployment > Web app di Apps Script Editor).
 *
 * Struktur file ini (digabung jadi satu untuk kemudahan hosting):
 *   1. BAGIAN: TEMA GELAP (DARK MODE)
 *   2. BAGIAN: INTI APLIKASI (state, API, shell, login, profil)
 *   3. BAGIAN: DASHBOARD, DATA MASTER, AKADEMIK, KESISWAAN,
 *      PENGUMUMAN/KALENDER/LAPORAN/PENGATURAN
 * ============================================================ */

/* ===================== BAGIAN: TEMA GELAP (DARK MODE) ===================== */

  /**
   * Mengaktifkan tema tersimpan sedini mungkin (dipanggil langsung saat file
   * ini di-include di <head>) supaya tidak ada "kedipan" warna saat halaman dimuat.
   */
  (function applyStoredTheme(){
    try{
      const tema = localStorage.getItem('wk_theme') || 'light';
      if (tema === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    }catch(e){ /* localStorage tidak tersedia, abaikan */ }
  })();

  function wkToggleTheme(){
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark){
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('wk_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('wk_theme', 'dark');
    }
  }


  /* ===================== BAGIAN: INTI APLIKASI (STATE, ROUTER, SHELL) ===================== */
  /* State global, pemanggil API (fetch ke backend Apps Script), shell
     (sidebar+navbar), login, logout, dan router antar halaman (SPA). */

  // ----------------------------- STATE GLOBAL -----------------------------
  const AppState = { token: null, user: null, currentKey: null, identitas: null };

  const ROLE_ADMIN = 'Administrator';
  const ROLE_KEPSEK = 'Kepala Sekolah';
  const ROLE_WAKASEK = 'Wakil Kepala Sekolah';
  const ROLE_WALI = 'Wali Kelas';
  const ROLE_GURU_MAPEL = 'Guru Mata Pelajaran';
  const ROLE_GURU_BK = 'Guru BK';
  const ROLE_SISWA = 'Siswa';
  const ROLE_ORTU = 'Orang Tua';
  const ROLE_SEMUA = [ROLE_ADMIN, ROLE_KEPSEK, ROLE_WAKASEK, ROLE_WALI, ROLE_GURU_MAPEL, ROLE_GURU_BK, ROLE_SISWA, ROLE_ORTU];

  const MENU_CONFIG = [
    { section: 'Utama', items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'space_dashboard', roles: ROLE_SEMUA }
    ]},
    { section: 'Data Master', items: [
      { key: 'master-tahunajaran', label: 'Tahun Ajaran', icon: 'event', roles: [ROLE_ADMIN] },
      { key: 'master-semester', label: 'Semester', icon: 'date_range', roles: [ROLE_ADMIN] },
      { key: 'master-jurusan', label: 'Jurusan', icon: 'account_tree', roles: [ROLE_ADMIN] },
      { key: 'master-kelas', label: 'Kelas', icon: 'door_front', roles: [ROLE_ADMIN] },
      { key: 'master-mapel', label: 'Mata Pelajaran', icon: 'menu_book', roles: [ROLE_ADMIN] },
      { key: 'master-guru', label: 'Guru', icon: 'badge', roles: [ROLE_ADMIN] },
      { key: 'master-siswa', label: 'Siswa', icon: 'groups', roles: [ROLE_ADMIN, ROLE_WALI] },
      { key: 'master-orangtua', label: 'Orang Tua', icon: 'family_restroom', roles: [ROLE_ADMIN, ROLE_WALI] },
      { key: 'master-ruangan', label: 'Ruangan', icon: 'meeting_room', roles: [ROLE_ADMIN] }
    ]},
    { section: 'Akademik', items: [
      { key: 'absensi', label: 'Absensi', icon: 'fact_check', roles: [ROLE_ADMIN, ROLE_WALI, ROLE_GURU_MAPEL] },
      { key: 'nilai', label: 'Input Nilai', icon: 'grade', roles: [ROLE_ADMIN, ROLE_WALI, ROLE_GURU_MAPEL] },
      { key: 'rapor', label: 'Rapor', icon: 'summarize', roles: ROLE_SEMUA }
    ]},
    { section: 'Kesiswaan', items: [
      { key: 'pelanggaran', label: 'Pelanggaran', icon: 'gavel', roles: ROLE_SEMUA },
      { key: 'prestasi', label: 'Prestasi', icon: 'emoji_events', roles: ROLE_SEMUA },
      { key: 'catatan-wali', label: 'Catatan Wali Kelas', icon: 'edit_note', roles: [ROLE_ADMIN, ROLE_WALI, ROLE_GURU_BK] }
    ]},
    { section: 'Informasi', items: [
      { key: 'pengumuman', label: 'Pengumuman', icon: 'campaign', roles: ROLE_SEMUA },
      { key: 'kalender', label: 'Kalender Akademik', icon: 'calendar_month', roles: ROLE_SEMUA }
    ]},
    { section: 'Laporan', items: [
      { key: 'laporan', label: 'Laporan', icon: 'summarize', roles: [ROLE_ADMIN, ROLE_WALI, ROLE_KEPSEK, ROLE_WAKASEK] }
    ]},
    { section: 'Sistem', items: [
      { key: 'pengaturan', label: 'Pengaturan', icon: 'settings', roles: [ROLE_ADMIN] },
      { key: 'profil', label: 'Profil Saya', icon: 'account_circle', roles: ROLE_SEMUA }
    ]}
  ];

  // ----------------------------- API WRAPPER -----------------------------
  // ============================================================
  // URL Web App backend (Google Apps Script). WAJIB DIISI setelah
  // Anda men-deploy backend (Deploy > New deployment > Web app).
  // Contoh: 'https://script.google.com/macros/s/AKfycb.../exec'
  // ============================================================
  const API_URL = 'https://script.google.com/macros/s/AKfycbxBDyZ-lMomY6m96HbhKj1knCxIfrtRtkXIYiADpXztzFiX4KWzn5FciDb27CBaKMsj/exec';

  /**
   * Pemanggil API ke backend Google Apps Script lewat HTTP POST.
   * Dipertahankan dengan ANTARMUKA (interface) yang PERSIS SAMA seperti
   * sebelumnya (mengembalikan Promise yang resolve ke {success,message,data})
   * supaya seluruh kode di app.js lainnya (semua fungsi render, semua
   * CRUD) TIDAK PERLU diubah sama sekali — hanya cara mengirimnya yang
   * berbeda (dulu google.script.run, sekarang fetch()).
   *
   * Catatan teknis: header Content-Type sengaja "text/plain;charset=utf-8"
   * (bukan "application/json") walau isinya JSON — supaya browser tidak
   * mengirim preflight OPTIONS terlebih dulu, karena Apps Script Web App
   * tidak menangani preflight tsb (ini adalah trik standar untuk kombinasi
   * frontend eksternal + backend Apps Script).
   */
  function apiCall(fnName){
    const args = Array.prototype.slice.call(arguments, 1);

    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fnName, args: args })
    })
      .then(function(response){ return response.json(); })
      .then(function(res){
        const pesanAsli = (res && res.message) ? String(res.message) : '';

        if (pesanAsli.indexOf('AUTH_INVALID_SESSION') !== -1){
          paksaLogoutSesiHabis();
          return { success:false, message:'Sesi Anda telah berakhir, silakan login kembali', data:null };
        }

        if (res && res.message){
          res.message = pesanAsli
            .replace(/^.*?Error:\s*/,'')
            .replace(/^AUTH_FORBIDDEN:\s*/,'');
        }
        return res;
      })
      .catch(function(err){
        return { success:false, message:'Gagal terhubung ke server: ' + err.message, data:null };
      });
  }

  /**
   * Dipanggil otomatis ketika backend mendeteksi sesi tidak valid/kedaluwarsa
   * di tengah pemakaian aplikasi (bukan hanya saat initApp awal), supaya
   * pengguna tidak terjebak di halaman yang sudah tidak bisa memuat data.
   */
  function paksaLogoutSesiHabis(){
    if (AppState.token === null) return;
    localStorage.removeItem('wk_token');
    AppState.token = null;
    AppState.user = null;
    renderLoginPage();
    toastGagal('Sesi Anda telah berakhir, silakan login kembali');
  }

  // ----------------------------- HELPER UI -----------------------------
  function toastSukses(pesan){
    Swal.fire({ icon:'success', title:pesan, toast:true, position:'top-end', showConfirmButton:false, timer:2200, timerProgressBar:true });
  }
  function toastGagal(pesan){
    Swal.fire({ icon:'error', title:pesan || 'Terjadi kesalahan', toast:true, position:'top-end', showConfirmButton:false, timer:3200, timerProgressBar:true });
  }
  function konfirmasiHapus(pesan){
    return Swal.fire({
      icon:'warning', title:'Yakin ingin menghapus?', text: pesan || 'Data yang dihapus tidak dapat dikembalikan.',
      showCancelButton:true, confirmButtonText:'Ya, hapus', cancelButtonText:'Batal',
      confirmButtonColor:'#B3392B', cancelButtonColor:'#6B6B65'
    }).then(function(r){ return r.isConfirmed; });
  }
  function escapeHtmlJS(text){
    if (text === null || text === undefined) return '';
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function tampilkanMemuatKonten(){
    document.getElementById('wk-content').innerHTML =
      '<div class="d-flex justify-content-center align-items-center" style="height:320px;"><div class="wk-spinner"></div></div>';
  }
  function setJudulHalaman(judul){
    const el = document.getElementById('wk-navbar-title');
    if (el) el.innerText = judul;
  }
  function tandaiMenuAktif(key){
    document.querySelectorAll('.wk-nav-item').forEach(function(el){
      el.classList.toggle('active', el.getAttribute('data-key') === key);
    });
  }
  function formatTanggalIndoJS(tgl){
    if (!tgl) return '-';
    const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const d = new Date(tgl);
    if (isNaN(d.getTime())) return String(tgl);
    return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
  }
  function formatTanggalPendekJS(tgl){
    if (!tgl) return '-';
    const d = new Date(tgl);
    if (isNaN(d.getTime())) return String(tgl);
    const pad = function(n){ return (n<10?'0':'')+n; };
    return pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear();
  }
  function pillStatusAbsensi(status){
    const kelas = 'wk-pill-' + String(status).toLowerCase();
    return '<span class="wk-pill ' + kelas + '">' + escapeHtmlJS(status) + '</span>';
  }
  function pillStatusNilai(status){
    const kelas = status === 'Tuntas' ? 'wk-pill-tuntas' : 'wk-pill-belumtuntas';
    return '<span class="wk-pill ' + kelas + '">' + escapeHtmlJS(status) + '</span>';
  }
  function hancurkanDataTableJikaAda(selector){
    if ($.fn.DataTable.isDataTable(selector)){
      $(selector).DataTable().destroy();
    }
  }
  const DATATABLE_LANG = {
    search:'Cari:', lengthMenu:'Tampilkan _MENU_ baris', info:'Menampilkan _START_ - _END_ dari _TOTAL_ data',
    infoEmpty:'Tidak ada data', infoFiltered:'(disaring dari _MAX_ total data)', zeroRecords:'Data tidak ditemukan',
    paginate:{ previous:'Sebelumnya', next:'Berikutnya' }
  };
  function inisialisasiDataTable(selector, opsiTambahan){
    hancurkanDataTableJikaAda(selector);
    return $(selector).DataTable(Object.assign({ language: DATATABLE_LANG, order: [] }, opsiTambahan || {}));
  }
  function tampilkanErrorView(pesan){
    document.getElementById('wk-content').innerHTML = '<div class="wk-card">' + kontenKosong('error_outline', pesan) + '</div>';
  }

  /**
   * Mengisi elemen <select> hasil bungkusKontenCrud (type:'select') dengan
   * daftar opsi dari data master lain, misalnya mengisi dropdown Kelas
   * dengan daftar Jurusan, atau dropdown Semester dengan daftar Tahun Ajaran.
   */
  function isiOpsiSelect(elementId, list, valueKey, labelKey){
    const el = document.getElementById(elementId);
    if (!el) return;
    const opsiKosong = el.querySelector('option[value=""]');
    el.innerHTML = '';
    if (opsiKosong) el.appendChild(opsiKosong); else {
      const o = document.createElement('option'); o.value=''; o.innerText='Pilih...'; el.appendChild(o);
    }
    list.forEach(function(item){
      const o = document.createElement('option');
      o.value = item[valueKey];
      o.innerText = item[labelKey];
      el.appendChild(o);
    });
  }

  /** Format objek Date/string tanggal manapun menjadi yyyy-MM-dd untuk value input type="date" */
  function formatTanggalJS(tgl){
    if (!tgl) return '';
    const d = new Date(tgl);
    if (isNaN(d.getTime())) return '';
    const pad = function(n){ return (n<10?'0':'')+n; };
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  }

  // ----------------------------- INISIALISASI APLIKASI -----------------------------
  function initApp(){
    AppState.token = localStorage.getItem('wk_token');

    if (!AppState.token){
      sembunyikanLoadingAwal();
      renderLoginPage();
      return;
    }

    apiCall('checkSession', AppState.token).then(function(res){
      sembunyikanLoadingAwal();
      if (res.success){
        AppState.user = res.data;
        renderAppShell();
        navigateTo('dashboard');
      } else {
        localStorage.removeItem('wk_token');
        renderLoginPage();
      }
    });
  }

  function sembunyikanLoadingAwal(){
    const el = document.getElementById('wk-loading-screen');
    if (el) el.remove();
  }

  // ----------------------------- HALAMAN LOGIN -----------------------------
  function renderLoginPage(){
    const root = document.getElementById('wk-root');
    root.innerHTML =
      '<div id="wk-login-page">' +
        '<div class="wk-login-card wk-fade-in">' +
          '<div class="wk-login-brand">' +
            '<h1>Aplikasi Wali Kelas</h1>' +
            '<p>Sistem informasi akademik dan kesiswaan terpadu untuk mendukung peran Wali Kelas, Guru, Siswa, dan Orang Tua dalam satu platform.</p>' +
          '</div>' +
          '<div class="wk-login-form-wrap">' +
            '<h2>Selamat Datang</h2>' +
            '<div class="wk-sub">Masuk menggunakan akun yang telah terdaftar</div>' +
            '<form id="wk-login-form">' +
              '<div class="mb-3"><label class="form-label">Username</label>' +
              '<input type="text" class="form-control" id="wk-login-username" required autofocus></div>' +
              '<div class="mb-3"><label class="form-label">Password</label>' +
              '<input type="password" class="form-control" id="wk-login-password" required></div>' +
              '<div id="wk-login-error" class="text-danger small mb-3" style="display:none;"></div>' +
              '<button type="submit" class="btn btn-primary w-100" id="wk-login-btn">Masuk</button>' +
            '</form>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('wk-login-form').addEventListener('submit', handleLogin);
  }

  function handleLogin(e){
    e.preventDefault();
    const username = document.getElementById('wk-login-username').value.trim();
    const password = document.getElementById('wk-login-password').value;
    const btn = document.getElementById('wk-login-btn');
    const errBox = document.getElementById('wk-login-error');

    errBox.style.display = 'none';
    btn.disabled = true;
    btn.innerText = 'Memproses...';

    apiCall('login', username, password, navigator.userAgent).then(function(res){
      btn.disabled = false;
      btn.innerText = 'Masuk';

      if (res.success){
        AppState.token = res.data.token;
        AppState.user = res.data.user;
        localStorage.setItem('wk_token', AppState.token);
        renderAppShell();
        navigateTo('dashboard');
      } else {
        errBox.innerText = res.message;
        errBox.style.display = 'block';
      }
    });
  }

  function logout(){
    Swal.fire({
      icon:'question', title:'Keluar dari aplikasi?', showCancelButton:true,
      confirmButtonText:'Ya, keluar', cancelButtonText:'Batal', confirmButtonColor:'#1B3A57'
    }).then(function(r){
      if (r.isConfirmed){
        apiCall('logout', AppState.token).then(function(){
          localStorage.removeItem('wk_token');
          AppState.token = null;
          AppState.user = null;
          renderLoginPage();
        });
      }
    });
  }

  // ----------------------------- APP SHELL (SIDEBAR + NAVBAR) -----------------------------
  function renderAppShell(){
    const user = AppState.user;
    const inisial = (user.nama || '?').trim().charAt(0).toUpperCase();

    const menuHtml = MENU_CONFIG.map(function(section){
      const items = section.items.filter(function(it){ return it.roles.indexOf(user.role) !== -1; });
      if (items.length === 0) return '';
      const itemsHtml = items.map(function(it){
        return '<div class="wk-nav-item" data-key="' + it.key + '" onclick="navigateTo(\'' + it.key + '\')">' +
                 '<span class="material-icons">' + it.icon + '</span><span>' + it.label + '</span>' +
               '</div>';
      }).join('');
      return '<div class="wk-nav-section-label">' + section.section + '</div>' + itemsHtml;
    }).join('');

    const root = document.getElementById('wk-root');
    root.innerHTML =
      '<div id="wk-app-shell">' +
        '<aside class="wk-sidebar" id="wk-sidebar">' +
          '<div class="wk-sidebar-brand">' +
            '<div class="wk-logo-dot">WK</div>' +
            '<div class="wk-sidebar-brand-text" id="wk-brand-text">Wali Kelas<small>Sistem Akademik</small></div>' +
          '</div>' +
          '<nav class="wk-sidebar-nav">' + menuHtml + '</nav>' +
          '<div class="wk-sidebar-footer">&copy; ' + new Date().getFullYear() + ' Aplikasi Wali Kelas</div>' +
        '</aside>' +
        '<div class="wk-main">' +
          '<header class="wk-navbar">' +
            '<div class="d-flex align-items-center gap-2">' +
              '<button id="wk-sidebar-toggle" class="wk-icon-btn" onclick="document.getElementById(\'wk-sidebar\').classList.toggle(\'wk-open\')">' +
                '<span class="material-icons">menu</span>' +
              '</button>' +
              '<div class="wk-navbar-title" id="wk-navbar-title">Dashboard</div>' +
            '</div>' +
            '<div class="wk-navbar-right">' +
              '<button class="wk-icon-btn" id="wk-theme-toggle" onclick="wkToggleTheme()" title="Ubah tema">' +
                '<span class="material-icons">dark_mode</span>' +
              '</button>' +
              '<button class="wk-icon-btn" onclick="navigateTo(\'pengumuman\')" title="Pengumuman">' +
                '<span class="material-icons">notifications</span>' +
              '</button>' +
              '<div class="dropdown">' +
                '<div class="d-flex align-items-center gap-2" style="cursor:pointer;" data-bs-toggle="dropdown">' +
                  '<div class="wk-avatar">' + inisial + '</div>' +
                '</div>' +
                '<ul class="dropdown-menu dropdown-menu-end mt-2">' +
                  '<li><h6 class="dropdown-header">' + escapeHtmlJS(user.nama) + '<br><small class="text-muted">' + escapeHtmlJS(user.role) + '</small></h6></li>' +
                  '<li><hr class="dropdown-divider"></li>' +
                  '<li><a class="dropdown-item" href="#" onclick="navigateTo(\'profil\');return false;">' +
                    '<span class="material-icons align-middle me-2" style="font-size:18px;">account_circle</span>Profil Saya</a></li>' +
                  '<li><a class="dropdown-item text-danger" href="#" onclick="logout();return false;">' +
                    '<span class="material-icons align-middle me-2" style="font-size:18px;">logout</span>Keluar</a></li>' +
                '</ul>' +
              '</div>' +
            '</div>' +
          '</header>' +
          '<main class="wk-content" id="wk-content"></main>' +
        '</div>' +
      '</div>';

    apiCall('getIdentitasSekolah', AppState.token).then(function(res){
      if (res.success && res.data){
        AppState.identitas = res.data;
        const brand = document.getElementById('wk-brand-text');
        if (brand && res.data.namaSekolah){
          brand.innerHTML = 'Wali Kelas<small>' + escapeHtmlJS(res.data.namaSekolah) + '</small>';
        }
      }
    });
  }

  // ----------------------------- ROUTER -----------------------------
  // ROUTES dibangun secara LAZY (baru dibuat saat pertama kali dipanggil),
  // bukan langsung sebagai const di top-level. Ini penting karena objek ini
  // memetakan ke fungsi render (renderDashboard, dll.) yang dideklarasikan
  // di file/script LAIN (Script_Views.html) yang dimuat SETELAH file ini.
  // Jika dibangun langsung (eager) saat file ini dieksekusi, fungsi-fungsi
  // tersebut belum ada -> ReferenceError -> ROUTES gagal terinisialisasi
  // selamanya. Dengan lazy init, ROUTES baru dibangun saat navigateTo()
  // benar-benar dipanggil (setelah semua script selesai dimuat), sehingga
  // aman dari urutan include file apapun.
  let _routesCache = null;
  function getRoutes(){
    if (!_routesCache){
      _routesCache = {
        'dashboard': renderDashboard,
        'master-tahunajaran': renderMasterTahunAjaran,
        'master-semester': renderMasterSemester,
        'master-jurusan': renderMasterJurusan,
        'master-kelas': renderMasterKelas,
        'master-mapel': renderMasterMapel,
        'master-guru': renderMasterGuru,
        'master-siswa': renderMasterSiswa,
        'master-orangtua': renderMasterOrangTua,
        'master-ruangan': renderMasterRuangan,
        'absensi': renderAbsensi,
        'nilai': renderNilai,
        'rapor': renderRapor,
        'pelanggaran': renderPelanggaran,
        'prestasi': renderPrestasi,
        'catatan-wali': renderCatatanWali,
        'pengumuman': renderPengumuman,
        'kalender': renderKalender,
        'laporan': renderLaporan,
        'pengaturan': renderPengaturan,
        'profil': renderProfil
      };
    }
    return _routesCache;
  }

  const JUDUL_HALAMAN = {
    'dashboard':'Dashboard','master-tahunajaran':'Tahun Ajaran','master-semester':'Semester',
    'master-jurusan':'Jurusan','master-kelas':'Kelas','master-mapel':'Mata Pelajaran',
    'master-guru':'Guru','master-siswa':'Siswa','master-orangtua':'Orang Tua','master-ruangan':'Ruangan',
    'absensi':'Absensi','nilai':'Input Nilai','rapor':'Rapor','pelanggaran':'Pelanggaran',
    'prestasi':'Prestasi','catatan-wali':'Catatan Wali Kelas','pengumuman':'Pengumuman',
    'kalender':'Kalender Akademik','laporan':'Laporan','pengaturan':'Pengaturan','profil':'Profil Saya'
  };

  function navigateTo(key){
    const routes = getRoutes();
    if (!routes[key]){
      toastGagal('Halaman tidak ditemukan');
      return;
    }
    AppState.currentKey = key;
    setJudulHalaman(JUDUL_HALAMAN[key] || key);
    tandaiMenuAktif(key);
    document.getElementById('wk-sidebar').classList.remove('wk-open');
    tampilkanMemuatKonten();
    routes[key]();
  }

  // ----------------------------- KOMPONEN BANTUAN VIEW CRUD GENERIK -----------------------------

  /**
   * Membangun tampilan CRUD generik (tabel + tombol Tambah + modal form)
   * untuk entitas data master yang sederhana (tanpa relasi kompleks),
   * misalnya Tahun Ajaran, Jurusan, Ruangan, Mata Pelajaran, Jenis Pelanggaran.
   */
  function bungkusKontenCrud(config, isiTabelHtml){
    const formFieldsHtml = config.formFields.map(function(f){
      const req = f.required ? 'required' : '';
      let input;
      if (f.type === 'textarea'){
        input = '<textarea class="form-control" id="wk-field-' + f.key + '" rows="3" ' + req + '></textarea>';
      } else if (f.type === 'select'){
        input = '<select class="form-select" id="wk-field-' + f.key + '" ' + req + '><option value="">Pilih...</option></select>';
      } else {
        input = '<input type="' + (f.type||'text') + '" class="form-control" id="wk-field-' + f.key + '" ' + req + '>';
      }
      return '<div class="mb-3"><label class="form-label">' + f.label + (f.required?' *':'') + '</label>' + input + '</div>';
    }).join('');

    return (
      '<div class="wk-fade-in">' +
        '<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">' +
          '<h5 class="mb-0">' + config.title + '</h5>' +
          '<button class="btn btn-primary btn-sm" onclick="wkBukaModalTambah()">' +
            '<span class="material-icons align-middle" style="font-size:16px;">add</span> Tambah</button>' +
        '</div>' +
        '<div class="wk-card wk-table-wrap">' + isiTabelHtml + '</div>' +
      '</div>' +
      '<div class="modal fade" id="wk-crud-modal" tabindex="-1">' +
        '<div class="modal-dialog"><div class="modal-content">' +
          '<div class="modal-header"><h5 class="modal-title" id="wk-crud-modal-title">Tambah Data</h5>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
          '<div class="modal-body">' +
            '<input type="hidden" id="wk-field-id">' + formFieldsHtml + (config.extraFormHtml || '') +
          '</div>' +
          '<div class="modal-footer">' +
            '<button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Batal</button>' +
            '<button class="btn btn-primary btn-sm" id="wk-crud-save-btn" onclick="wkSimpanCrud()">Simpan</button>' +
          '</div>' +
        '</div></div>' +
      '</div>'
    );
  }

  let wkCrudConfigAktif = null;
  let wkCrudModalInstance = null;
  let wkListCache = [];

  /**
   * Dipanggil dari tombol edit pada baris tabel. Alih-alih menyisipkan
   * JSON mentah ke atribut onclick (rawan error karena tanda kutip),
   * setiap render tabel menyimpan datanya ke wkListCache lalu tombol
   * cukup mengirim index-nya saja.
   */
  function wkBukaModalEditByIndex(i){
    wkBukaModalEdit(wkListCache[i]);
  }

  function wkBukaModalTambah(){
    wkCrudConfigAktif.formFields.forEach(function(f){
      const el = document.getElementById('wk-field-' + f.key);
      if (el) el.value = '';
    });
    document.getElementById('wk-field-id').value = '';
    if (typeof wkCrudConfigAktif.resetExtra === 'function') wkCrudConfigAktif.resetExtra();
    document.getElementById('wk-crud-modal-title').innerText = 'Tambah ' + wkCrudConfigAktif.title;
    wkCrudModalInstance.show();
  }

  function wkBukaModalEdit(item){
    wkCrudConfigAktif.formFields.forEach(function(f){
      const el = document.getElementById('wk-field-' + f.key);
      if (el) el.value = (item[f.key] !== undefined && item[f.key] !== null) ? item[f.key] : '';
    });
    document.getElementById('wk-field-id').value = item[wkCrudConfigAktif.idField];
    // Field pembuatan akun (buatAkun/roleAkun) hanya relevan untuk data BARU,
    // jadi selalu direset/nonaktifkan saat membuka mode Edit.
    if (typeof wkCrudConfigAktif.resetExtra === 'function') wkCrudConfigAktif.resetExtra();
    document.getElementById('wk-crud-modal-title').innerText = 'Ubah ' + wkCrudConfigAktif.title;
    wkCrudModalInstance.show();
  }

  function wkSimpanCrud(){
    const data = { id: document.getElementById('wk-field-id').value || undefined };
    wkCrudConfigAktif.formFields.forEach(function(f){
      const el = document.getElementById('wk-field-' + f.key);
      data[f.key] = el ? el.value : '';
    });
    if (typeof wkCrudConfigAktif.extraDataCollector === 'function'){
      Object.assign(data, wkCrudConfigAktif.extraDataCollector());
    }

    apiCall(wkCrudConfigAktif.apiSave, AppState.token, data).then(function(res){
      if (res.success){
        wkCrudModalInstance.hide();
        toastSukses(res.message);
        navigateTo(AppState.currentKey);
      } else {
        toastGagal(res.message);
      }
    });
  }

  function wkHapusCrud(id){
    konfirmasiHapus().then(function(ok){
      if (!ok) return;
      apiCall(wkCrudConfigAktif.apiDelete, AppState.token, id).then(function(res){
        if (res.success){
          toastSukses(res.message);
          navigateTo(AppState.currentKey);
        } else {
          toastGagal(res.message);
        }
      });
    });
  }


  /* ===================== BAGIAN: PROFIL SAYA & GANTI PASSWORD ===================== */

  function renderProfil(){
    const user = AppState.user;
    const inisial = (user.nama || '?').trim().charAt(0).toUpperCase();

    const html =
      '<div class="wk-fade-in" style="max-width:540px;">' +
        '<div class="wk-card mb-3">' +
          '<div class="d-flex align-items-center gap-3 mb-3">' +
            '<div class="wk-avatar" style="width:58px;height:58px;font-size:1.35rem;">' + inisial + '</div>' +
            '<div>' +
              '<div style="font-weight:600;font-size:1.02rem;">' + escapeHtmlJS(user.nama) + '</div>' +
              '<div class="text-muted small">' + escapeHtmlJS(user.role) + '</div>' +
            '</div>' +
          '</div>' +
          '<hr>' +
          '<div class="row">' +
            '<div class="col-6"><div class="small text-muted mb-1">Username</div><div class="mb-2">' + escapeHtmlJS(user.username) + '</div></div>' +
            '<div class="col-6"><div class="small text-muted mb-1">Email</div><div class="mb-2">' + escapeHtmlJS(user.email || '-') + '</div></div>' +
          '</div>' +
        '</div>' +
        '<div class="wk-card">' +
          '<div class="wk-card-title"><span class="material-icons">lock</span>Ganti Password</div>' +
          '<div class="mb-3"><label class="form-label">Password Lama</label><input type="password" class="form-control" id="wk-pass-lama"></div>' +
          '<div class="mb-3"><label class="form-label">Password Baru</label><input type="password" class="form-control" id="wk-pass-baru"></div>' +
          '<div class="mb-3"><label class="form-label">Konfirmasi Password Baru</label><input type="password" class="form-control" id="wk-pass-konfirmasi"></div>' +
          '<button class="btn btn-primary btn-sm" onclick="wkGantiPassword()">Simpan Password Baru</button>' +
        '</div>' +
      '</div>';

    document.getElementById('wk-content').innerHTML = html;
  }

  function wkGantiPassword(){
    const lama = document.getElementById('wk-pass-lama').value;
    const baru = document.getElementById('wk-pass-baru').value;
    const konfirmasi = document.getElementById('wk-pass-konfirmasi').value;

    if (!lama || !baru || !konfirmasi){ toastGagal('Semua kolom wajib diisi'); return; }
    if (baru !== konfirmasi){ toastGagal('Konfirmasi password baru tidak sama'); return; }
    if (baru.length < 6){ toastGagal('Password baru minimal 6 karakter'); return; }

    apiCall('changePassword', AppState.token, lama, baru).then(function(res){
      if (res.success){
        toastSukses(res.message);
        document.getElementById('wk-pass-lama').value = '';
        document.getElementById('wk-pass-baru').value = '';
        document.getElementById('wk-pass-konfirmasi').value = '';
      } else {
        toastGagal(res.message);
      }
    });
  }


  /* ===================== BAGIAN: DASHBOARD ===================== */
  /* Tampilannya menyesuaikan otomatis dengan role pengguna yang login. */

  function renderDashboard(){
    apiCall('getDashboardData', AppState.token).then(function(res){
      if (!res.success){
        document.getElementById('wk-content').innerHTML = '<div class="wk-card">' + kontenKosong('error_outline', res.message) + '</div>';
        return;
      }

      const data = res.data;
      const role = AppState.user.role;
      let kontenUtama = '';

      if (role === ROLE_ADMIN || role === ROLE_KEPSEK || role === ROLE_WAKASEK){
        kontenUtama = dashboardAdminHtml(data, role === ROLE_ADMIN);
      } else if (role === ROLE_WALI){
        kontenUtama = dashboardWaliHtml(data);
      } else if (role === ROLE_GURU_MAPEL){
        kontenUtama = dashboardGuruMapelHtml(data);
      } else if (role === ROLE_GURU_BK){
        kontenUtama = dashboardGuruBKHtml(data);
      } else if (role === ROLE_SISWA){
        kontenUtama = ringkasanSiswaHtml(data, null);
      } else if (role === ROLE_ORTU){
        kontenUtama = dashboardOrtuHtml(data);
      }

      const sampingHtml =
        '<div class="col-lg-4">' +
          '<div class="wk-card mb-3">' +
            '<div class="wk-card-title"><span class="material-icons">event</span>Agenda Hari Ini</div>' +
            renderAgendaList(data.kalenderHariIni) +
          '</div>' +
          '<div class="wk-card">' +
            '<div class="wk-card-title"><span class="material-icons">campaign</span>Pengumuman Terbaru</div>' +
            renderPengumumanRingkas(data.pengumumanTerbaru) +
          '</div>' +
        '</div>';

      document.getElementById('wk-content').innerHTML =
        '<div class="row g-3 wk-fade-in">' +
          '<div class="col-lg-8">' + kontenUtama + '</div>' +
          sampingHtml +
        '</div>';

      if (data.grafikAbsensi) gambarGrafikAbsensi(data.grafikAbsensi);
    });
  }

  function kontenKosong(icon, pesan){
    return '<div class="wk-empty-state"><span class="material-icons">' + (icon||'info') + '</span><div>' + escapeHtmlJS(pesan || 'Tidak ada data') + '</div></div>';
  }

  function statCardCol(icon, bgClass, value, label){
    return '<div class="col-6 col-lg-3"><div class="wk-card wk-stat-card">' +
      '<div class="wk-stat-icon ' + bgClass + '"><span class="material-icons">' + icon + '</span></div>' +
      '<div><div class="wk-stat-value">' + (value !== undefined && value !== null ? value : 0) + '</div>' +
      '<div class="wk-stat-label">' + label + '</div></div>' +
    '</div></div>';
  }

  function pillBesar(label, value, warnaKey){
    return '<div class="text-center px-2"><div style="font-weight:700;font-size:1.15rem;color:var(--c-' + warnaKey + ');">' +
      (value || 0) + '</div><div class="text-muted" style="font-size:.72rem;">' + label + '</div></div>';
  }

  // ----------------------------- ADMIN / KEPSEK / WAKASEK -----------------------------
  function dashboardAdminHtml(data, tampilkanAktivitas){
    const stat = data.absensiHariIni || {};
    let html =
      '<div class="row g-3 mb-3">' +
        statCardCol('groups','wk-bg-primary-soft', data.totalSiswa, 'Total Siswa') +
        statCardCol('badge','wk-bg-info-soft', data.totalGuru, 'Total Guru') +
        statCardCol('door_front','wk-bg-success-soft', data.totalKelas, 'Total Kelas') +
        statCardCol('gavel','wk-bg-warning-soft', data.totalPelanggaranBulanIni, 'Pelanggaran Bulan Ini') +
      '</div>' +
      '<div class="wk-card mb-3">' +
        '<div class="wk-card-title"><span class="material-icons">bar_chart</span>Tren Kehadiran 7 Hari Terakhir</div>' +
        '<canvas id="wk-chart-absensi" height="90"></canvas>' +
      '</div>' +
      '<div class="row g-3 mb-3">' +
        '<div class="col-md-6"><div class="wk-card"><div class="wk-card-title"><span class="material-icons">fact_check</span>Absensi Hari Ini</div>' +
          '<div class="d-flex gap-2 flex-wrap">' +
            pillBesar('Hadir', stat.Hadir, 'success') + pillBesar('Izin', stat.Izin, 'info') + pillBesar('Sakit', stat.Sakit, 'info') +
            pillBesar('Alpha', stat.Alpha, 'danger') + pillBesar('Terlambat', stat.Terlambat, 'warning') +
          '</div></div></div>' +
        '<div class="col-md-6"><div class="wk-card"><div class="wk-card-title"><span class="material-icons">insights</span>Ringkasan Bulan Ini</div>' +
          '<div class="d-flex justify-content-between mb-2"><span class="text-muted small">Prestasi baru</span><strong>' + data.totalPrestasiBulanIni + '</strong></div>' +
          '<div class="d-flex justify-content-between"><span class="text-muted small">Pelanggaran baru</span><strong>' + data.totalPelanggaranBulanIni + '</strong></div>' +
        '</div></div>' +
      '</div>';

    if (tampilkanAktivitas && data.aktivitasTerbaru){
      html += '<div class="wk-card"><div class="wk-card-title"><span class="material-icons">history</span>Aktivitas Terbaru</div>' +
        (data.aktivitasTerbaru.length ? data.aktivitasTerbaru.map(function(a){
          return '<div class="wk-list-item"><span class="material-icons text-muted" style="font-size:18px;">bolt</span>' +
            '<div><div style="font-size:.85rem;">' + escapeHtmlJS(a.Aksi) + ' &mdash; ' + escapeHtmlJS(a.Detail) + '</div>' +
            '<div class="text-muted" style="font-size:.72rem;">' + formatTanggalIndoJS(a.Waktu) + '</div></div></div>';
        }).join('') : kontenKosong('history','Belum ada aktivitas')) +
      '</div>';
    }
    return html;
  }

  // ----------------------------- WALI KELAS -----------------------------
  function dashboardWaliHtml(data){
    if (!data.adaKelas){
      return '<div class="wk-card">' + kontenKosong('info', data.pesan) + '</div>';
    }
    const stat = data.absensiHariIni || {};
    return (
      '<div class="row g-3 mb-3">' +
        statCardCol('groups','wk-bg-primary-soft', data.jumlahSiswa, 'Siswa di ' + data.namaKelas) +
        statCardCol('fact_check','wk-bg-success-soft', stat.Hadir||0, 'Hadir Hari Ini') +
        statCardCol('report','wk-bg-danger-soft', stat.Alpha||0, 'Alpha Hari Ini') +
        statCardCol('pending_actions','wk-bg-warning-soft', stat.BelumDiinput||0, 'Belum Diinput') +
      '</div>' +
      '<div class="row g-3 mb-3">' +
        '<div class="col-md-6"><div class="wk-card"><div class="wk-card-title"><span class="material-icons">schedule</span>Jadwal Mengajar Hari Ini</div>' +
        renderJadwalList(data.jadwalMengajarHariIni) + '</div></div>' +
        '<div class="col-md-6"><div class="wk-card"><div class="wk-card-title"><span class="material-icons">gavel</span>Pelanggaran Terbaru</div>' +
        renderPelanggaranRingkas(data.pelanggaranTerbaru) + '</div></div>' +
      '</div>' +
      '<div class="wk-card"><div class="wk-card-title"><span class="material-icons">emoji_events</span>Prestasi Terbaru</div>' +
      renderPrestasiRingkas(data.prestasiTerbaru) + '</div>'
    );
  }

  // ----------------------------- GURU MAPEL -----------------------------
  function dashboardGuruMapelHtml(data){
    return (
      '<div class="row g-3 mb-3">' +
        statCardCol('door_front','wk-bg-primary-soft', data.totalKelasDiampu, 'Kelas Diampu') +
      '</div>' +
      '<div class="wk-card"><div class="wk-card-title"><span class="material-icons">schedule</span>Jadwal Mengajar Hari Ini</div>' +
      renderJadwalList(data.jadwalMengajarHariIni) + '</div>'
    );
  }

  // ----------------------------- GURU BK -----------------------------
  function dashboardGuruBKHtml(data){
    return (
      '<div class="row g-3 mb-3">' +
        statCardCol('psychology','wk-bg-primary-soft', data.totalKonseling, 'Total Konseling') +
        statCardCol('event_note','wk-bg-info-soft', data.konselingBulanIni, 'Konseling Bulan Ini') +
      '</div>' +
      '<div class="wk-card"><div class="wk-card-title"><span class="material-icons">forum</span>Konseling Terbaru</div>' +
      (data.konselingTerbaru && data.konselingTerbaru.length ? data.konselingTerbaru.map(function(k){
        return '<div class="wk-list-item"><span class="material-icons text-muted" style="font-size:18px;">person</span>' +
          '<div><div style="font-size:.85rem;">' + escapeHtmlJS(k.Masalah) + '</div>' +
          '<div class="text-muted" style="font-size:.72rem;">' + formatTanggalIndoJS(k.Tanggal) + '</div></div></div>';
      }).join('') : kontenKosong('forum','Belum ada data konseling')) + '</div>'
    );
  }

  // ----------------------------- SISWA & ORANG TUA -----------------------------
  function ringkasanSiswaHtml(ringkasan, judulNama){
    const stat = ringkasan.absensiBulanIni || {};
    let html = '';
    if (judulNama) html += '<h6 class="mb-3">' + escapeHtmlJS(judulNama) + '</h6>';
    html +=
      '<div class="row g-3 mb-3">' +
        statCardCol('fact_check','wk-bg-success-soft', stat.Hadir||0, 'Hadir Bulan Ini') +
        statCardCol('gavel','wk-bg-danger-soft', ringkasan.totalPoinPelanggaran||0, 'Poin Pelanggaran') +
        statCardCol('emoji_events','wk-bg-warning-soft', ringkasan.totalPrestasi||0, 'Total Prestasi') +
      '</div>' +
      '<div class="row g-3 mb-3">' +
        '<div class="col-md-6"><div class="wk-card"><div class="wk-card-title"><span class="material-icons">gavel</span>Pelanggaran Terbaru</div>' +
        renderPelanggaranRingkas(ringkasan.pelanggaranTerbaru) + '</div></div>' +
        '<div class="col-md-6"><div class="wk-card"><div class="wk-card-title"><span class="material-icons">emoji_events</span>Prestasi Terbaru</div>' +
        renderPrestasiRingkas(ringkasan.prestasiTerbaru) + '</div></div>' +
      '</div>';
    return html;
  }

  function dashboardOrtuHtml(data){
    if (!data.anak || data.anak.length === 0){
      return '<div class="wk-card">' + kontenKosong('family_restroom','Belum ada data anak yang terhubung ke akun Anda') + '</div>';
    }
    return data.anak.map(function(a){ return ringkasanSiswaHtml(a, a.namaSiswa); }).join('<hr class="my-4">');
  }

  // ----------------------------- KOMPONEN LIST BERSAMA -----------------------------
  function renderAgendaList(list){
    if (!list || list.length === 0) return kontenKosong('event_busy','Tidak ada agenda hari ini');
    const bulanSingkat = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
    return list.map(function(k){
      const d = new Date(k.Tanggal_Mulai);
      return '<div class="wk-agenda-item"><div class="wk-agenda-date"><div>' + d.getDate() + '</div><div>' + bulanSingkat[d.getMonth()] + '</div></div>' +
        '<div><div style="font-size:.85rem;font-weight:500;">' + escapeHtmlJS(k.Judul) + '</div>' +
        '<div class="text-muted" style="font-size:.75rem;">' + escapeHtmlJS(k.Jenis) + '</div></div></div>';
    }).join('');
  }

  function renderPengumumanRingkas(list){
    if (!list || list.length === 0) return kontenKosong('campaign','Belum ada pengumuman');
    return list.map(function(p){
      return '<div class="wk-list-item"><span class="material-icons text-muted" style="font-size:18px;">campaign</span>' +
        '<div><div style="font-size:.85rem;font-weight:500;">' + escapeHtmlJS(p.Judul) + '</div>' +
        '<div class="text-muted" style="font-size:.75rem;">' + formatTanggalIndoJS(p.Tanggal_Publish) + '</div></div></div>';
    }).join('');
  }

  function renderJadwalList(list){
    if (!list || list.length === 0) return kontenKosong('event_available','Tidak ada jadwal mengajar hari ini');
    return list.map(function(j){
      return '<div class="wk-list-item"><span class="material-icons text-muted" style="font-size:18px;">schedule</span>' +
        '<div><div style="font-size:.85rem;font-weight:500;">' + escapeHtmlJS(j.namaMapel) + ' &mdash; ' + escapeHtmlJS(j.namaKelas) + '</div>' +
        '<div class="text-muted" style="font-size:.75rem;">' + j.jamMulai + ' - ' + j.jamSelesai + '</div></div></div>';
    }).join('');
  }

  function renderPelanggaranRingkas(list){
    if (!list || list.length === 0) return kontenKosong('sentiment_satisfied','Tidak ada pelanggaran');
    return list.map(function(p){
      return '<div class="wk-list-item"><span class="material-icons text-muted" style="font-size:18px;">gavel</span>' +
        '<div><div style="font-size:.85rem;">' + escapeHtmlJS(p.Nama_Pelanggaran || '-') + '</div>' +
        '<div class="text-muted" style="font-size:.75rem;">' + formatTanggalIndoJS(p.Tanggal) + ' &middot; ' + (p.Poin||0) + ' poin</div></div></div>';
    }).join('');
  }

  function renderPrestasiRingkas(list){
    if (!list || list.length === 0) return kontenKosong('emoji_events','Belum ada prestasi');
    return list.map(function(p){
      return '<div class="wk-list-item"><span class="material-icons text-muted" style="font-size:18px;">emoji_events</span>' +
        '<div><div style="font-size:.85rem;">' + escapeHtmlJS(p.Nama_Prestasi) + '</div>' +
        '<div class="text-muted" style="font-size:.75rem;">' + escapeHtmlJS(p.Tingkat) + ' &middot; ' + formatTanggalIndoJS(p.Tanggal) + '</div></div></div>';
    }).join('');
  }

  let wkChartAbsensiInstance = null;
  function gambarGrafikAbsensi(grafik){
    const canvas = document.getElementById('wk-chart-absensi');
    if (!canvas) return;
    if (wkChartAbsensiInstance) wkChartAbsensiInstance.destroy();
    wkChartAbsensiInstance = new Chart(canvas.getContext('2d'), {
      type:'line',
      data:{ labels: grafik.label, datasets:[{ label:'Hadir', data: grafik.data, borderColor:'#1B3A57', backgroundColor:'rgba(27,58,87,.08)', fill:true, tension:.35 }]},
      options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } }, maintainAspectRatio:true }
    });
  }


  /* ===================== BAGIAN: DATA MASTER ===================== */
  /* CRUD untuk Tahun Ajaran, Semester, Jurusan, Kelas, Mata Pelajaran,
     Guru, Siswa, Orang Tua, Ruangan. */

  /**
   * Helper generik untuk entitas master yang sederhana (tanpa relasi
   * kompleks): Jurusan, Ruangan, Mata Pelajaran.
   */
  function renderMasterSederhana(opts){
    apiCall(opts.apiGet, AppState.token).then(function(res){
      if (!res.success){ tampilkanErrorView(res.message); return; }
      const data = res.data;

      wkCrudConfigAktif = {
        title: opts.title, idField: opts.idField, apiSave: opts.apiSave, apiDelete: opts.apiDelete,
        formFields: opts.formFields, mapToForm: opts.mapToForm
      };
      wkListCache = data.map(function(d){ return opts.mapToForm ? opts.mapToForm(d) : d; });

      const headerHtml = opts.kolom.map(function(k){ return '<th>' + k.header + '</th>'; }).join('') + '<th class="text-end">Aksi</th>';
      const barisHtml = data.map(function(d, i){
        const kolomHtml = opts.kolom.map(function(k){ return '<td>' + k.get(d) + '</td>'; }).join('');
        return '<tr>' + kolomHtml +
          '<td class="text-end">' +
            '<span class="material-icons wk-row-action" onclick="wkBukaModalEditByIndex(' + i + ')">edit</span>' +
            '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusCrud(\'' + d[opts.idField] + '\')">delete</span>' +
          '</td></tr>';
      }).join('');

      const tabel = '<table class="table" id="wk-dt-master"><thead><tr>' + headerHtml + '</tr></thead><tbody>' + barisHtml + '</tbody></table>';
      document.getElementById('wk-content').innerHTML = bungkusKontenCrud(wkCrudConfigAktif, tabel);
      wkCrudModalInstance = new bootstrap.Modal(document.getElementById('wk-crud-modal'));
      inisialisasiDataTable('#wk-dt-master');
    });
  }

  // ===================== JURUSAN =====================
  function renderMasterJurusan(){
    renderMasterSederhana({
      apiGet:'getSemuaJurusan', title:'Jurusan', idField:'ID_Jurusan', apiSave:'simpanJurusan', apiDelete:'hapusJurusan',
      formFields:[
        { key:'kodeJurusan', label:'Kode Jurusan', required:true },
        { key:'namaJurusan', label:'Nama Jurusan', required:true }
      ],
      mapToForm:function(d){ return { ID_Jurusan:d.ID_Jurusan, kodeJurusan:d.Kode_Jurusan, namaJurusan:d.Nama_Jurusan }; },
      kolom:[
        { header:'Kode', get:function(d){ return escapeHtmlJS(d.Kode_Jurusan); } },
        { header:'Nama Jurusan', get:function(d){ return escapeHtmlJS(d.Nama_Jurusan); } }
      ]
    });
  }

  // ===================== RUANGAN =====================
  function renderMasterRuangan(){
    renderMasterSederhana({
      apiGet:'getSemuaRuangan', title:'Ruangan', idField:'ID_Ruangan', apiSave:'simpanRuangan', apiDelete:'hapusRuangan',
      formFields:[
        { key:'namaRuangan', label:'Nama Ruangan', required:true },
        { key:'kapasitas', label:'Kapasitas', type:'number' },
        { key:'lokasi', label:'Lokasi' }
      ],
      mapToForm:function(d){ return { ID_Ruangan:d.ID_Ruangan, namaRuangan:d.Nama_Ruangan, kapasitas:d.Kapasitas, lokasi:d.Lokasi }; },
      kolom:[
        { header:'Nama Ruangan', get:function(d){ return escapeHtmlJS(d.Nama_Ruangan); } },
        { header:'Kapasitas', get:function(d){ return d.Kapasitas || '-'; } },
        { header:'Lokasi', get:function(d){ return escapeHtmlJS(d.Lokasi||'-'); } }
      ]
    });
  }

  // ===================== MATA PELAJARAN =====================
  function renderMasterMapel(){
    renderMasterSederhana({
      apiGet:'getSemuaMataPelajaran', title:'Mata Pelajaran', idField:'ID_MataPelajaran', apiSave:'simpanMataPelajaran', apiDelete:'hapusMataPelajaran',
      formFields:[
        { key:'kodeMapel', label:'Kode Mata Pelajaran', required:true },
        { key:'namaMapel', label:'Nama Mata Pelajaran', required:true },
        { key:'kelompok', label:'Kelompok (Umum/Kejuruan)' },
        { key:'kkm', label:'KKM', type:'number' }
      ],
      mapToForm:function(d){ return { ID_MataPelajaran:d.ID_MataPelajaran, kodeMapel:d.Kode_MataPelajaran, namaMapel:d.Nama_MataPelajaran, kelompok:d.Kelompok, kkm:d.KKM }; },
      kolom:[
        { header:'Kode', get:function(d){ return escapeHtmlJS(d.Kode_MataPelajaran); } },
        { header:'Nama Mata Pelajaran', get:function(d){ return escapeHtmlJS(d.Nama_MataPelajaran); } },
        { header:'Kelompok', get:function(d){ return escapeHtmlJS(d.Kelompok||'-'); } },
        { header:'KKM', get:function(d){ return d.KKM || 75; } }
      ]
    });
  }

  // ===================== TAHUN AJARAN =====================
  function renderMasterTahunAjaran(){
    apiCall('getSemuaTahunAjaran', AppState.token).then(function(res){
      if (!res.success){ tampilkanErrorView(res.message); return; }
      const data = res.data;

      wkCrudConfigAktif = {
        title:'Tahun Ajaran', idField:'ID_TahunAjaran', apiSave:'simpanTahunAjaran', apiDelete:'hapusTahunAjaran',
        formFields:[ { key:'namaTahunAjaran', label:'Nama Tahun Ajaran (contoh: 2025/2026)', required:true } ],
        mapToForm:function(d){ return { ID_TahunAjaran:d.ID_TahunAjaran, namaTahunAjaran:d.Nama_TahunAjaran }; }
      };
      wkListCache = data.map(wkCrudConfigAktif.mapToForm);

      const baris = data.map(function(d, i){
        const aktif = (d.Status_Aktif === true || String(d.Status_Aktif).toUpperCase() === 'TRUE');
        return '<tr><td>' + escapeHtmlJS(d.Nama_TahunAjaran) + '</td>' +
          '<td>' + (aktif ? '<span class="wk-pill wk-pill-tuntas">Aktif</span>' : '<span class="text-muted small">Tidak aktif</span>') + '</td>' +
          '<td class="text-end">' +
            (!aktif ? '<button class="btn btn-sm btn-outline-primary me-1" onclick="wkAktifkanTahunAjaran(\'' + d.ID_TahunAjaran + '\')">Aktifkan</button>' : '') +
            '<span class="material-icons wk-row-action" onclick="wkBukaModalEditByIndex(' + i + ')">edit</span>' +
            '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusCrud(\'' + d.ID_TahunAjaran + '\')">delete</span>' +
          '</td></tr>';
      }).join('');

      const tabel = '<table class="table" id="wk-dt-ta"><thead><tr><th>Nama</th><th>Status</th><th class="text-end">Aksi</th></tr></thead><tbody>' + baris + '</tbody></table>';
      document.getElementById('wk-content').innerHTML = bungkusKontenCrud(wkCrudConfigAktif, tabel);
      wkCrudModalInstance = new bootstrap.Modal(document.getElementById('wk-crud-modal'));
      inisialisasiDataTable('#wk-dt-ta');
    });
  }

  function wkAktifkanTahunAjaran(id){
    apiCall('aktifkanTahunAjaran', AppState.token, id).then(function(res){
      if (res.success){ toastSukses(res.message); navigateTo('master-tahunajaran'); } else { toastGagal(res.message); }
    });
  }

  // ===================== SEMESTER =====================
  function renderMasterSemester(){
    Promise.all([
      apiCall('getSemuaSemester', AppState.token),
      apiCall('getSemuaTahunAjaran', AppState.token)
    ]).then(function(hasil){
      const resSem = hasil[0], resTA = hasil[1];
      if (!resSem.success){ tampilkanErrorView(resSem.message); return; }
      const data = resSem.data;
      const daftarTA = resTA.success ? resTA.data : [];

      wkCrudConfigAktif = {
        title:'Semester', idField:'ID_Semester', apiSave:'simpanSemester', apiDelete:'hapusSemester',
        formFields:[
          { key:'idTahunAjaran', label:'Tahun Ajaran', type:'select', required:true },
          { key:'namaSemester', label:'Nama Semester (Ganjil/Genap)', required:true },
          { key:'tanggalMulai', label:'Tanggal Mulai', type:'date', required:true },
          { key:'tanggalSelesai', label:'Tanggal Selesai', type:'date', required:true }
        ],
        mapToForm:function(d){
          return { ID_Semester:d.ID_Semester, idTahunAjaran:d.ID_TahunAjaran, namaSemester:d.Nama_Semester,
            tanggalMulai:formatTanggalJS(d.Tanggal_Mulai), tanggalSelesai:formatTanggalJS(d.Tanggal_Selesai) };
        }
      };
      wkListCache = data.map(wkCrudConfigAktif.mapToForm);

      const baris = data.map(function(d, i){
        const aktif = (d.Status_Aktif === true || String(d.Status_Aktif).toUpperCase() === 'TRUE');
        return '<tr><td>' + escapeHtmlJS(d.Nama_TahunAjaran) + '</td><td>' + escapeHtmlJS(d.Nama_Semester) + '</td>' +
          '<td>' + formatTanggalPendekJS(d.Tanggal_Mulai) + ' - ' + formatTanggalPendekJS(d.Tanggal_Selesai) + '</td>' +
          '<td>' + (aktif ? '<span class="wk-pill wk-pill-tuntas">Aktif</span>' : '<span class="text-muted small">Tidak aktif</span>') + '</td>' +
          '<td class="text-end">' +
            (!aktif ? '<button class="btn btn-sm btn-outline-primary me-1" onclick="wkAktifkanSemester(\'' + d.ID_Semester + '\')">Aktifkan</button>' : '') +
            '<span class="material-icons wk-row-action" onclick="wkBukaModalEditByIndex(' + i + ')">edit</span>' +
            '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusCrud(\'' + d.ID_Semester + '\')">delete</span>' +
          '</td></tr>';
      }).join('');

      const tabel = '<table class="table" id="wk-dt-sem"><thead><tr><th>Tahun Ajaran</th><th>Semester</th><th>Periode</th><th>Status</th><th class="text-end">Aksi</th></tr></thead><tbody>' + baris + '</tbody></table>';
      document.getElementById('wk-content').innerHTML = bungkusKontenCrud(wkCrudConfigAktif, tabel);

      isiOpsiSelect('wk-field-idTahunAjaran', daftarTA, 'ID_TahunAjaran', 'Nama_TahunAjaran');

      wkCrudModalInstance = new bootstrap.Modal(document.getElementById('wk-crud-modal'));
      inisialisasiDataTable('#wk-dt-sem');
    });
  }

  function wkAktifkanSemester(id){
    apiCall('aktifkanSemester', AppState.token, id).then(function(res){
      if (res.success){ toastSukses(res.message); navigateTo('master-semester'); } else { toastGagal(res.message); }
    });
  }

  // ===================== KELAS =====================
  function renderMasterKelas(){
    Promise.all([
      apiCall('getSemuaKelas', AppState.token),
      apiCall('getSemuaJurusan', AppState.token),
      apiCall('getSemuaGuru', AppState.token),
      apiCall('getSemuaRuangan', AppState.token),
      apiCall('getSemuaTahunAjaran', AppState.token)
    ]).then(function(hasil){
      const resKelas = hasil[0], resJurusan = hasil[1], resGuru = hasil[2], resRuangan = hasil[3], resTA = hasil[4];
      if (!resKelas.success){ tampilkanErrorView(resKelas.message); return; }

      const data = resKelas.data;
      const daftarJurusan = resJurusan.success ? resJurusan.data : [];
      const daftarGuru = resGuru.success ? resGuru.data : [];
      const daftarRuangan = resRuangan.success ? resRuangan.data : [];
      const daftarTA = resTA.success ? resTA.data : [];

      wkCrudConfigAktif = {
        title:'Kelas', idField:'id', apiSave:'simpanKelas', apiDelete:'hapusKelas',
        formFields:[
          { key:'namaKelas', label:'Nama Kelas (contoh: XII RPL 1)', required:true },
          { key:'tingkat', label:'Tingkat (X/XI/XII)', required:true },
          { key:'idJurusan', label:'Jurusan', type:'select' },
          { key:'idWaliKelas', label:'Wali Kelas', type:'select' },
          { key:'idRuangan', label:'Ruangan', type:'select' },
          { key:'idTahunAjaran', label:'Tahun Ajaran', type:'select' }
        ],
        mapToForm:function(d){ return { id:d.id, namaKelas:d.namaKelas, tingkat:d.tingkat, idJurusan:d.idJurusan, idWaliKelas:d.idWaliKelas, idRuangan:d.idRuangan, idTahunAjaran:d.idTahunAjaran }; }
      };
      wkListCache = data.map(wkCrudConfigAktif.mapToForm);

      const baris = data.map(function(d, i){
        return '<tr><td>' + escapeHtmlJS(d.namaKelas) + '</td><td>' + escapeHtmlJS(d.tingkat) + '</td>' +
          '<td>' + escapeHtmlJS(d.namaJurusan) + '</td><td>' + escapeHtmlJS(d.namaWaliKelas) + '</td>' +
          '<td>' + escapeHtmlJS(d.namaRuangan) + '</td><td>' + d.jumlahSiswa + ' siswa</td>' +
          '<td class="text-end">' +
            '<span class="material-icons wk-row-action" onclick="wkBukaModalEditByIndex(' + i + ')">edit</span>' +
            '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusCrud(\'' + d.id + '\')">delete</span>' +
          '</td></tr>';
      }).join('');

      const tabel = '<table class="table" id="wk-dt-kelas"><thead><tr><th>Kelas</th><th>Tingkat</th><th>Jurusan</th><th>Wali Kelas</th><th>Ruangan</th><th>Jml Siswa</th><th class="text-end">Aksi</th></tr></thead><tbody>' + baris + '</tbody></table>';
      document.getElementById('wk-content').innerHTML = bungkusKontenCrud(wkCrudConfigAktif, tabel);

      isiOpsiSelect('wk-field-idJurusan', daftarJurusan, 'ID_Jurusan', 'Nama_Jurusan');
      isiOpsiSelect('wk-field-idWaliKelas', daftarGuru, 'ID_Guru', 'Nama_Guru');
      isiOpsiSelect('wk-field-idRuangan', daftarRuangan, 'ID_Ruangan', 'Nama_Ruangan');
      isiOpsiSelect('wk-field-idTahunAjaran', daftarTA, 'ID_TahunAjaran', 'Nama_TahunAjaran');

      wkCrudModalInstance = new bootstrap.Modal(document.getElementById('wk-crud-modal'));
      inisialisasiDataTable('#wk-dt-kelas');
    });
  }

  // ===================== GURU =====================
  function renderMasterGuru(){
    apiCall('getSemuaGuru', AppState.token).then(function(res){
      if (!res.success){ tampilkanErrorView(res.message); return; }
      const data = res.data;

      wkCrudConfigAktif = {
        title:'Guru', idField:'ID_Guru', apiSave:'simpanGuru', apiDelete:'hapusGuru',
        formFields:[
          { key:'nip', label:'NIP', required:true },
          { key:'namaGuru', label:'Nama Lengkap', required:true },
          { key:'jenisKelamin', label:'Jenis Kelamin (L/P)' },
          { key:'noHp', label:'No. HP' },
          { key:'email', label:'Email', type:'email' },
          { key:'alamat', label:'Alamat', type:'textarea' },
          { key:'statusKepegawaian', label:'Status Kepegawaian (PNS/GTY/Honorer)' }
        ],
        extraFormHtml:
          '<div class="mb-3 form-check">' +
            '<input type="checkbox" class="form-check-input" id="wk-field-buatAkun">' +
            '<label class="form-check-label" for="wk-field-buatAkun">Buatkan akun login (khusus data baru, password default: guru123)</label>' +
          '</div>' +
          '<div class="mb-3"><label class="form-label">Role Akun</label>' +
            '<select class="form-select" id="wk-field-roleAkun">' +
              '<option value="Guru Mata Pelajaran">Guru Mata Pelajaran</option>' +
              '<option value="Wali Kelas">Wali Kelas</option>' +
              '<option value="Guru BK">Guru BK</option>' +
              '<option value="Wakil Kepala Sekolah">Wakil Kepala Sekolah</option>' +
              '<option value="Kepala Sekolah">Kepala Sekolah</option>' +
            '</select></div>',
        extraDataCollector:function(){
          return {
            buatAkun: document.getElementById('wk-field-buatAkun').checked,
            roleAkun: document.getElementById('wk-field-roleAkun').value
          };
        },
        resetExtra:function(){
          document.getElementById('wk-field-buatAkun').checked = false;
          document.getElementById('wk-field-roleAkun').value = 'Guru Mata Pelajaran';
        },
        mapToForm:function(d){
          return { ID_Guru:d.ID_Guru, nip:d.NIP, namaGuru:d.Nama_Guru, jenisKelamin:d.Jenis_Kelamin,
            noHp:d.No_HP, email:d.Email, alamat:d.Alamat, statusKepegawaian:d.Status_Kepegawaian };
        }
      };
      wkListCache = data.map(wkCrudConfigAktif.mapToForm);

      const baris = data.map(function(d, i){
        return '<tr><td>' + escapeHtmlJS(d.NIP) + '</td><td>' + escapeHtmlJS(d.Nama_Guru) + '</td>' +
          '<td>' + escapeHtmlJS(d.No_HP||'-') + '</td><td>' + escapeHtmlJS(d.Status_Kepegawaian||'-') + '</td>' +
          '<td class="text-end">' +
            '<span class="material-icons wk-row-action" onclick="wkBukaModalEditByIndex(' + i + ')">edit</span>' +
            '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusCrud(\'' + d.ID_Guru + '\')">delete</span>' +
          '</td></tr>';
      }).join('');

      const tabel = '<table class="table" id="wk-dt-guru"><thead><tr><th>NIP</th><th>Nama</th><th>No. HP</th><th>Status</th><th class="text-end">Aksi</th></tr></thead><tbody>' + baris + '</tbody></table>';
      document.getElementById('wk-content').innerHTML = bungkusKontenCrud(wkCrudConfigAktif, tabel);
      wkCrudModalInstance = new bootstrap.Modal(document.getElementById('wk-crud-modal'));
      inisialisasiDataTable('#wk-dt-guru');
    });
  }

  // ===================== SISWA =====================
  let wkImportSiswaModalInstance = null;

  function renderMasterSiswa(){
    Promise.all([
      apiCall('getSemuaSiswa', AppState.token, null),
      apiCall('getSemuaKelas', AppState.token),
      apiCall('getSemuaOrangTua', AppState.token)
    ]).then(function(hasil){
      const resSiswa = hasil[0], resKelas = hasil[1], resOrtu = hasil[2];
      if (!resSiswa.success){ tampilkanErrorView(resSiswa.message); return; }

      const data = resSiswa.data;
      const daftarKelas = resKelas.success ? resKelas.data : [];
      const daftarOrtu = resOrtu.success ? resOrtu.data : [];
      daftarOrtu.forEach(function(o){ o.namaTampil = (o.Nama_Ayah || o.Nama_Ibu || 'Orang Tua') + ' (' + o.No_HP + ')'; });

      wkCrudConfigAktif = {
        title:'Siswa', idField:'ID_Siswa', apiSave:'simpanSiswa', apiDelete:'hapusSiswa',
        formFields:[
          { key:'nis', label:'NIS', required:true },
          { key:'nisn', label:'NISN' },
          { key:'namaSiswa', label:'Nama Lengkap', required:true },
          { key:'jenisKelamin', label:'Jenis Kelamin (L/P)' },
          { key:'tempatLahir', label:'Tempat Lahir' },
          { key:'tanggalLahir', label:'Tanggal Lahir', type:'date' },
          { key:'agama', label:'Agama' },
          { key:'alamat', label:'Alamat', type:'textarea' },
          { key:'noHp', label:'No. HP' },
          { key:'idKelas', label:'Kelas', type:'select', required:true },
          { key:'idOrangTua', label:'Orang Tua', type:'select' }
        ],
        extraFormHtml:
          '<div class="mb-3 form-check">' +
            '<input type="checkbox" class="form-check-input" id="wk-field-buatAkun">' +
            '<label class="form-check-label" for="wk-field-buatAkun">Buatkan akun login siswa (khusus data baru, password default: siswa123)</label>' +
          '</div>',
        extraDataCollector:function(){ return { buatAkun: document.getElementById('wk-field-buatAkun').checked }; },
        resetExtra:function(){ document.getElementById('wk-field-buatAkun').checked = false; },
        mapToForm:function(d){
          return {
            ID_Siswa:d.ID_Siswa, nis:d.NIS, nisn:d.NISN, namaSiswa:d.Nama_Siswa, jenisKelamin:d.Jenis_Kelamin,
            tempatLahir:d.Tempat_Lahir, tanggalLahir:formatTanggalJS(d.Tanggal_Lahir), agama:d.Agama,
            alamat:d.Alamat, noHp:d.No_HP, idKelas:d.ID_Kelas, idOrangTua:d.ID_OrangTua
          };
        }
      };
      wkListCache = data.map(wkCrudConfigAktif.mapToForm);

      const petaKelas = {};
      daftarKelas.forEach(function(k){ petaKelas[k.id] = k.namaKelas; });

      const baris = data.map(function(d, i){
        const statusAktif = (d.Status_Aktif === true || String(d.Status_Aktif).toUpperCase() === 'TRUE');
        return '<tr><td>' + escapeHtmlJS(d.NIS) + '</td><td>' + escapeHtmlJS(d.Nama_Siswa) + '</td>' +
          '<td>' + escapeHtmlJS(petaKelas[d.ID_Kelas]||'-') + '</td>' +
          '<td>' + (statusAktif ? '<span class="wk-pill wk-pill-tuntas">Aktif</span>' : '<span class="wk-pill wk-pill-belumtuntas">Nonaktif</span>') + '</td>' +
          '<td class="text-end">' +
            '<span class="material-icons wk-row-action" onclick="wkBukaModalEditByIndex(' + i + ')">edit</span>' +
            '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusCrud(\'' + d.ID_Siswa + '\')">delete</span>' +
          '</td></tr>';
      }).join('');

      const tabel = '<table class="table" id="wk-dt-siswa"><thead><tr><th>NIS</th><th>Nama</th><th>Kelas</th><th>Status</th><th class="text-end">Aksi</th></tr></thead><tbody>' + baris + '</tbody></table>';

      let html = bungkusKontenCrud(wkCrudConfigAktif, tabel);
      html = html.replace('<button class="btn btn-primary btn-sm" onclick="wkBukaModalTambah()">',
        '<button class="btn btn-outline-primary btn-sm me-2" onclick="wkBukaModalImportSiswa()">' +
          '<span class="material-icons align-middle" style="font-size:16px;">upload_file</span> Import Massal</button>' +
        '<button class="btn btn-primary btn-sm" onclick="wkBukaModalTambah()">');
      html += htmlModalImportSiswa();

      document.getElementById('wk-content').innerHTML = html;

      isiOpsiSelect('wk-field-idKelas', daftarKelas, 'id', 'namaKelas');
      isiOpsiSelect('wk-field-idOrangTua', daftarOrtu, 'ID_OrangTua', 'namaTampil');
      isiOpsiSelect('wk-import-kelas', daftarKelas, 'id', 'namaKelas');

      wkCrudModalInstance = new bootstrap.Modal(document.getElementById('wk-crud-modal'));
      wkImportSiswaModalInstance = new bootstrap.Modal(document.getElementById('wk-import-siswa-modal'));
      inisialisasiDataTable('#wk-dt-siswa');
    });
  }

  function htmlModalImportSiswa(){
    return '<div class="modal fade" id="wk-import-siswa-modal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">' +
      '<div class="modal-header"><h5 class="modal-title">Import Siswa Massal</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
      '<div class="modal-body">' +
        '<div class="mb-3"><label class="form-label">Pilih Kelas Tujuan</label><select class="form-select" id="wk-import-kelas"></select></div>' +
        '<div class="mb-2"><label class="form-label">Data Siswa</label>' +
        '<div class="text-muted small mb-2">Satu siswa per baris, format: <code>NIS, Nama Lengkap, L/P</code>. Bisa disalin langsung dari Excel/Spreadsheet.</div>' +
        '<textarea class="form-control" id="wk-import-textarea" rows="8" placeholder="12345, Ahmad Fauzi, L&#10;12346, Siti Aminah, P"></textarea></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Batal</button>' +
        '<button class="btn btn-primary btn-sm" onclick="wkProsesImportSiswa()">Import Sekarang</button>' +
      '</div>' +
    '</div></div></div>';
  }

  function wkBukaModalImportSiswa(){
    document.getElementById('wk-import-textarea').value = '';
    wkImportSiswaModalInstance.show();
  }

  function wkProsesImportSiswa(){
    const idKelas = document.getElementById('wk-import-kelas').value;
    const teks = document.getElementById('wk-import-textarea').value.trim();
    if (!idKelas){ toastGagal('Pilih kelas tujuan terlebih dahulu'); return; }
    if (!teks){ toastGagal('Data siswa tidak boleh kosong'); return; }

    const baris = teks.split('\n').map(function(b){ return b.trim(); }).filter(Boolean);
    const arraySiswa = baris.map(function(b){
      const kolom = b.split(',').map(function(k){ return k.trim(); });
      return { nis: kolom[0]||'', namaSiswa: kolom[1]||'', jenisKelamin: kolom[2]||'' };
    });

    apiCall('importSiswaBatch', AppState.token, idKelas, arraySiswa).then(function(res){
      if (res.success){
        wkImportSiswaModalInstance.hide();
        toastSukses(res.message);
        navigateTo('master-siswa');
      } else {
        toastGagal(res.message);
      }
    });
  }

  // ===================== ORANG TUA =====================
  function renderMasterOrangTua(){
    apiCall('getSemuaOrangTua', AppState.token).then(function(res){
      if (!res.success){ tampilkanErrorView(res.message); return; }
      const data = res.data;

      wkCrudConfigAktif = {
        title:'Orang Tua', idField:'ID_OrangTua', apiSave:'simpanOrangTua', apiDelete:'hapusOrangTua',
        formFields:[
          { key:'namaAyah', label:'Nama Ayah' },
          { key:'namaIbu', label:'Nama Ibu' },
          { key:'pekerjaanAyah', label:'Pekerjaan Ayah' },
          { key:'pekerjaanIbu', label:'Pekerjaan Ibu' },
          { key:'noHp', label:'No. HP (dipakai sebagai username akun)', required:true },
          { key:'email', label:'Email', type:'email' },
          { key:'alamat', label:'Alamat', type:'textarea' }
        ],
        extraFormHtml:
          '<div class="mb-3 form-check">' +
            '<input type="checkbox" class="form-check-input" id="wk-field-buatAkun">' +
            '<label class="form-check-label" for="wk-field-buatAkun">Buatkan akun login orang tua (khusus data baru, password default: ortu123)</label>' +
          '</div>',
        extraDataCollector:function(){ return { buatAkun: document.getElementById('wk-field-buatAkun').checked }; },
        resetExtra:function(){ document.getElementById('wk-field-buatAkun').checked = false; },
        mapToForm:function(d){
          return { ID_OrangTua:d.ID_OrangTua, namaAyah:d.Nama_Ayah, namaIbu:d.Nama_Ibu, pekerjaanAyah:d.Pekerjaan_Ayah,
            pekerjaanIbu:d.Pekerjaan_Ibu, noHp:d.No_HP, email:d.Email, alamat:d.Alamat };
        }
      };
      wkListCache = data.map(wkCrudConfigAktif.mapToForm);

      const baris = data.map(function(d, i){
        return '<tr><td>' + escapeHtmlJS(d.Nama_Ayah||'-') + '</td><td>' + escapeHtmlJS(d.Nama_Ibu||'-') + '</td>' +
          '<td>' + escapeHtmlJS(d.No_HP) + '</td>' +
          '<td class="text-end">' +
            '<span class="material-icons wk-row-action" onclick="wkBukaModalEditByIndex(' + i + ')">edit</span>' +
            '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusCrud(\'' + d.ID_OrangTua + '\')">delete</span>' +
          '</td></tr>';
      }).join('');

      const tabel = '<table class="table" id="wk-dt-ortu"><thead><tr><th>Nama Ayah</th><th>Nama Ibu</th><th>No. HP</th><th class="text-end">Aksi</th></tr></thead><tbody>' + baris + '</tbody></table>';
      document.getElementById('wk-content').innerHTML = bungkusKontenCrud(wkCrudConfigAktif, tabel);
      wkCrudModalInstance = new bootstrap.Modal(document.getElementById('wk-crud-modal'));
      inisialisasiDataTable('#wk-dt-ortu');
    });
  }


  /* ===================== BAGIAN: AKADEMIK (ABSENSI, NILAI, RAPOR) ===================== */

  // ===================== ABSENSI =====================
  const wkAbsensiState = { mode:'harian' };

  function renderAbsensi(){
    wkAbsensiState.mode = 'harian';
    Promise.all([
      apiCall('getSemuaKelas', AppState.token),
      apiCall('getSemuaSemester', AppState.token)
    ]).then(function(hasil){
      const resKelas = hasil[0], resSem = hasil[1];
      if (!resKelas.success){ tampilkanErrorView(resKelas.message); return; }

      const daftarKelas = resKelas.data;
      const daftarSemester = resSem.success ? resSem.data : [];
      const opsiKelas = daftarKelas.map(function(k){ return '<option value="'+k.id+'">'+escapeHtmlJS(k.namaKelas)+'</option>'; }).join('');
      const opsiSemester = daftarSemester.map(function(s){ return '<option value="'+s.ID_Semester+'">'+escapeHtmlJS(s.Nama_Semester+' - '+s.Nama_TahunAjaran)+'</option>'; }).join('');
      const hariIni = formatTanggalJS(new Date());

      const html =
        '<div class="wk-fade-in">' +
          '<div class="mb-3">' +
            '<button class="btn btn-sm btn-primary me-2" onclick="wkTabAbsensi(\'harian\')" id="wk-tab-harian">Input Harian</button>' +
            '<button class="btn btn-sm btn-outline-primary me-2" onclick="wkTabAbsensi(\'bulanan\')" id="wk-tab-bulanan">Rekap Bulanan</button>' +
            '<button class="btn btn-sm btn-outline-primary" onclick="wkTabAbsensi(\'semester\')" id="wk-tab-semester">Rekap Semester</button>' +
          '</div>' +
          '<div class="wk-card mb-3"><div class="row g-2 align-items-end">' +
            '<div class="col-md-4"><label class="form-label">Kelas</label><select class="form-select" id="wk-absensi-kelas"><option value="">Pilih kelas...</option>'+opsiKelas+'</select></div>' +
            '<div class="col-md-3" id="wk-absensi-tanggal-wrap"><label class="form-label">Tanggal</label><input type="date" class="form-control" id="wk-absensi-tanggal" value="'+hariIni+'"></div>' +
            '<div class="col-md-3 d-none" id="wk-absensi-bulan-wrap"><label class="form-label">Bulan</label><input type="month" class="form-control" id="wk-absensi-bulan" value="'+hariIni.substring(0,7)+'"></div>' +
            '<div class="col-md-3 d-none" id="wk-absensi-semester-wrap"><label class="form-label">Semester</label><select class="form-select" id="wk-absensi-semester">'+opsiSemester+'</select></div>' +
            '<div class="col-md-2"><button class="btn btn-primary w-100" onclick="wkMuatAbsensi()">Tampilkan</button></div>' +
          '</div></div>' +
          '<div id="wk-absensi-hasil"></div>' +
        '</div>';

      document.getElementById('wk-content').innerHTML = html;
    });
  }

  function wkTabAbsensi(mode){
    wkAbsensiState.mode = mode;
    ['harian','bulanan','semester'].forEach(function(m){
      document.getElementById('wk-tab-'+m).className = 'btn btn-sm me-2 ' + (m===mode?'btn-primary':'btn-outline-primary');
    });
    document.getElementById('wk-absensi-tanggal-wrap').classList.toggle('d-none', mode!=='harian');
    document.getElementById('wk-absensi-bulan-wrap').classList.toggle('d-none', mode!=='bulanan');
    document.getElementById('wk-absensi-semester-wrap').classList.toggle('d-none', mode!=='semester');
    document.getElementById('wk-absensi-hasil').innerHTML = '';
  }

  function wkMuatAbsensi(){
    const idKelas = document.getElementById('wk-absensi-kelas').value;
    if (!idKelas){ toastGagal('Pilih kelas terlebih dahulu'); return; }

    if (wkAbsensiState.mode === 'harian'){
      const tanggal = document.getElementById('wk-absensi-tanggal').value;
      apiCall('getAbsensiHarian', AppState.token, tanggal, idKelas).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderTabelAbsensiHarian(res.data, tanggal, idKelas);
      });
    } else if (wkAbsensiState.mode === 'bulanan'){
      const bulanValue = document.getElementById('wk-absensi-bulan').value;
      const bagian = bulanValue.split('-');
      apiCall('getRekapAbsensiBulanan', AppState.token, idKelas, Number(bagian[1])-1, Number(bagian[0])).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderTabelRekapAbsensi(res.data);
      });
    } else {
      const idSemester = document.getElementById('wk-absensi-semester').value;
      if (!idSemester){ toastGagal('Pilih semester terlebih dahulu'); return; }
      apiCall('getRekapAbsensiSemester', AppState.token, idKelas, idSemester).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderTabelRekapAbsensi(res.data);
      });
    }
  }

  function renderTabelAbsensiHarian(daftarSiswa, tanggal, idKelas){
    const opsiStatus = ['Hadir','Izin','Sakit','Alpha','Terlambat'];
    if (daftarSiswa.length === 0){
      document.getElementById('wk-absensi-hasil').innerHTML = '<div class="wk-card">' + kontenKosong('groups','Belum ada siswa di kelas ini') + '</div>';
      return;
    }
    const baris = daftarSiswa.map(function(s, i){
      const opsiHtml = opsiStatus.map(function(o){ return '<option value="'+o+'"'+(o===s.status?' selected':'')+'>'+o+'</option>'; }).join('');
      return '<tr><td>'+(i+1)+'</td><td>'+escapeHtmlJS(s.nis)+'</td><td>'+escapeHtmlJS(s.namaSiswa)+'</td>' +
        '<td><select class="form-select form-select-sm wk-absen-status" data-id="'+s.idSiswa+'">'+opsiHtml+'</select></td>' +
        '<td><input type="text" class="form-control form-control-sm wk-absen-ket" data-id="'+s.idSiswa+'" value="'+escapeHtmlJS(s.keterangan)+'" placeholder="Keterangan (opsional)"></td></tr>';
    }).join('');

    document.getElementById('wk-absensi-hasil').innerHTML =
      '<div class="wk-card wk-table-wrap"><div class="table-responsive"><table class="table" id="wk-dt-absen-harian">' +
      '<thead><tr><th>No</th><th>NIS</th><th>Nama</th><th style="width:160px;">Status</th><th>Keterangan</th></tr></thead><tbody>'+baris+'</tbody></table></div>' +
      '<button class="btn btn-primary btn-sm mt-2" onclick="wkSimpanAbsensiHarian(\''+tanggal+'\',\''+idKelas+'\')">Simpan Absensi</button></div>';
  }

  function wkSimpanAbsensiHarian(tanggal, idKelas){
    const arrayAbsensi = [];
    document.querySelectorAll('.wk-absen-status').forEach(function(sel){
      const id = sel.getAttribute('data-id');
      const ketEl = document.querySelector('.wk-absen-ket[data-id="'+id+'"]');
      arrayAbsensi.push({ idSiswa:id, status:sel.value, keterangan: ketEl ? ketEl.value : '' });
    });

    apiCall('inputAbsensiHarian', AppState.token, tanggal, idKelas, arrayAbsensi).then(function(res){
      if (res.success){ toastSukses(res.message); } else { toastGagal(res.message); }
    });
  }

  function renderTabelRekapAbsensi(data){
    if (data.length === 0){
      document.getElementById('wk-absensi-hasil').innerHTML = '<div class="wk-card">' + kontenKosong('groups','Belum ada siswa di kelas ini') + '</div>';
      return;
    }
    const baris = data.map(function(d, i){
      const r = d.rekap;
      return '<tr><td>'+(i+1)+'</td><td>'+escapeHtmlJS(d.nis)+'</td><td>'+escapeHtmlJS(d.namaSiswa)+'</td>' +
        '<td>'+r.Hadir+'</td><td>'+r.Izin+'</td><td>'+r.Sakit+'</td><td>'+r.Alpha+'</td><td>'+r.Terlambat+'</td><td>'+d.totalHari+'</td></tr>';
    }).join('');

    document.getElementById('wk-absensi-hasil').innerHTML =
      '<div class="wk-card wk-table-wrap"><div class="table-responsive"><table class="table" id="wk-dt-rekap-absen">' +
      '<thead><tr><th>No</th><th>NIS</th><th>Nama</th><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Alpha</th><th>Terlambat</th><th>Total</th></tr></thead>' +
      '<tbody>'+baris+'</tbody></table></div></div>';

    inisialisasiDataTable('#wk-dt-rekap-absen');
  }

  // ===================== INPUT NILAI =====================
  function renderNilai(){
    Promise.all([
      apiCall('getSemuaKelas', AppState.token),
      apiCall('getSemuaMataPelajaran', AppState.token),
      apiCall('getSemuaSemester', AppState.token)
    ]).then(function(hasil){
      const resKelas = hasil[0], resMapel = hasil[1], resSem = hasil[2];
      if (!resKelas.success){ tampilkanErrorView(resKelas.message); return; }

      const opsiKelas = resKelas.data.map(function(k){ return '<option value="'+k.id+'">'+escapeHtmlJS(k.namaKelas)+'</option>'; }).join('');
      const opsiMapel = (resMapel.success?resMapel.data:[]).map(function(m){ return '<option value="'+m.ID_MataPelajaran+'">'+escapeHtmlJS(m.Nama_MataPelajaran)+'</option>'; }).join('');
      const opsiSemester = (resSem.success?resSem.data:[]).map(function(s){ return '<option value="'+s.ID_Semester+'">'+escapeHtmlJS(s.Nama_Semester+' - '+s.Nama_TahunAjaran)+'</option>'; }).join('');

      const html =
        '<div class="wk-fade-in">' +
          '<div class="wk-card mb-3">' +
            '<div class="row g-2 align-items-end">' +
              '<div class="col-md-3"><label class="form-label">Kelas</label><select class="form-select" id="wk-nilai-kelas"><option value="">Pilih...</option>'+opsiKelas+'</select></div>' +
              '<div class="col-md-3"><label class="form-label">Mata Pelajaran</label><select class="form-select" id="wk-nilai-mapel"><option value="">Pilih...</option>'+opsiMapel+'</select></div> ' +
              '<div class="col-md-3"><label class="form-label">Semester</label><select class="form-select" id="wk-nilai-semester"><option value="">Pilih...</option>'+opsiSemester+'</select></div>' +
              '<div class="col-md-3"><label class="form-label">Jenis Nilai</label><select class="form-select" id="wk-nilai-jenis" onchange="wkUbahJenisNilai()">' +
                '<option value="Tugas">Tugas</option><option value="Ulangan">Ulangan</option><option value="PTS">PTS</option><option value="PAS">PAS</option>' +
              '</select></div>' +
            '</div>' +
            '<div class="row g-2 mt-2" id="wk-nilai-nama-wrap">' +
              '<div class="col-md-6"><label class="form-label">Nama Tugas / Ulangan</label>' +
                '<input list="wk-nilai-nama-list" id="wk-nilai-nama-penilaian" class="form-control" placeholder="Ketik nama baru, atau pilih dari daftar yang sudah ada">' +
                '<datalist id="wk-nilai-nama-list"></datalist>' +
              '</div>' +
              '<div class="col-md-2 d-flex align-items-end"><button class="btn btn-primary w-100" onclick="wkMuatNilaiKelas()">Muat Data</button></div>' +
            '</div>' +
            '<div class="row g-2 mt-2" id="wk-nilai-tanpa-nama-wrap" style="display:none;">' +
              '<div class="col-md-2"><button class="btn btn-primary w-100" onclick="wkMuatNilaiKelas()">Muat Data</button></div>' +
            '</div>' +
          '</div>' +
          '<div id="wk-nilai-hasil"></div>' +
        '</div>';

      document.getElementById('wk-content').innerHTML = html;
    });
  }

  function wkUbahJenisNilai(){
    const jenis = document.getElementById('wk-nilai-jenis').value;
    const butuhNama = (jenis === 'Tugas' || jenis === 'Ulangan');
    document.getElementById('wk-nilai-nama-wrap').style.display = butuhNama ? 'flex' : 'none';
    document.getElementById('wk-nilai-tanpa-nama-wrap').style.display = butuhNama ? 'none' : 'flex';
  }

  function isiDatalist(id, arrayNama){
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = arrayNama.map(function(n){ return '<option value="'+escapeHtmlJS(n)+'">'; }).join('');
  }

  function wkMuatNilaiKelas(){
    const idKelas = document.getElementById('wk-nilai-kelas').value;
    const idMapel = document.getElementById('wk-nilai-mapel').value;
    const idSemester = document.getElementById('wk-nilai-semester').value;
    const jenis = document.getElementById('wk-nilai-jenis').value;

    if (!idKelas || !idMapel || !idSemester){ toastGagal('Lengkapi kelas, mata pelajaran, dan semester'); return; }

    if (jenis === 'Tugas'){
      const nama = document.getElementById('wk-nilai-nama-penilaian').value.trim();
      if (!nama){ toastGagal('Nama tugas wajib diisi'); return; }
      apiCall('getDaftarTugas', AppState.token, idMapel, idSemester).then(function(r){ if (r.success) isiDatalist('wk-nilai-nama-list', r.data); });
      apiCall('getNilaiTugasKelas', AppState.token, idKelas, idMapel, idSemester, nama).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderTabelInputNilai(res.data, idMapel, idSemester, jenis, nama);
      });
    } else if (jenis === 'Ulangan'){
      const nama = document.getElementById('wk-nilai-nama-penilaian').value.trim();
      if (!nama){ toastGagal('Nama ulangan wajib diisi'); return; }
      apiCall('getDaftarUlangan', AppState.token, idMapel, idSemester).then(function(r){ if (r.success) isiDatalist('wk-nilai-nama-list', r.data); });
      apiCall('getNilaiUlanganKelas', AppState.token, idKelas, idMapel, idSemester, nama).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderTabelInputNilai(res.data, idMapel, idSemester, jenis, nama);
      });
    } else if (jenis === 'PTS'){
      apiCall('getNilaiPTSKelas', AppState.token, idKelas, idMapel, idSemester).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderTabelInputNilai(res.data, idMapel, idSemester, jenis, '');
      });
    } else {
      apiCall('getNilaiPASKelas', AppState.token, idKelas, idMapel, idSemester).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderTabelInputNilai(res.data, idMapel, idSemester, jenis, '');
      });
    }
  }

  function renderTabelInputNilai(daftarSiswa, idMapel, idSemester, jenis, namaPenilaian){
    if (daftarSiswa.length === 0){
      document.getElementById('wk-nilai-hasil').innerHTML = '<div class="wk-card">' + kontenKosong('groups','Belum ada siswa di kelas ini') + '</div>';
      return;
    }
    const baris = daftarSiswa.map(function(s, i){
      return '<tr><td>'+(i+1)+'</td><td>'+escapeHtmlJS(s.namaSiswa)+'</td>' +
        '<td><input type="number" min="0" max="100" class="form-control form-control-sm wk-nilai-input" data-id="'+s.idSiswa+'" value="'+(s.nilai!==''&&s.nilai!==undefined?s.nilai:'')+'"></td></tr>';
    }).join('');

    document.getElementById('wk-nilai-hasil').innerHTML =
      '<div class="wk-card wk-table-wrap"><div class="table-responsive"><table class="table" id="wk-dt-input-nilai">' +
      '<thead><tr><th>No</th><th>Nama</th><th style="width:120px;">Nilai</th></tr></thead><tbody>'+baris+'</tbody></table></div>' +
      '<button class="btn btn-primary btn-sm mt-2" id="wk-btn-simpan-nilai" data-mapel="'+idMapel+'" data-semester="'+idSemester+'" data-jenis="'+jenis+'" data-nama="'+escapeHtmlJS(namaPenilaian)+'" onclick="wkSimpanNilaiKelas()">Simpan Semua Nilai</button></div>';
  }

  function wkSimpanNilaiKelas(){
    const btn = document.getElementById('wk-btn-simpan-nilai');
    const idMapel = btn.getAttribute('data-mapel');
    const idSemester = btn.getAttribute('data-semester');
    const jenis = btn.getAttribute('data-jenis');
    const namaPenilaian = btn.getAttribute('data-nama');
    const idKelas = document.getElementById('wk-nilai-kelas').value;

    const arrayNilai = [];
    document.querySelectorAll('.wk-nilai-input').forEach(function(inp){
      if (inp.value !== ''){ arrayNilai.push({ idSiswa: inp.getAttribute('data-id'), nilai: Number(inp.value) }); }
    });
    if (arrayNilai.length === 0){ toastGagal('Belum ada nilai yang diisi'); return; }

    const tanggal = formatTanggalJS(new Date());
    let panggilan;
    if (jenis === 'Tugas'){
      panggilan = apiCall('simpanNilaiTugasBatch', AppState.token, idMapel, idSemester, namaPenilaian, tanggal, arrayNilai);
    } else if (jenis === 'Ulangan'){
      panggilan = apiCall('simpanNilaiUlanganBatch', AppState.token, idMapel, idSemester, namaPenilaian, tanggal, arrayNilai);
    } else if (jenis === 'PTS'){
      panggilan = apiCall('simpanNilaiPTSBatch', AppState.token, idKelas, idMapel, idSemester, arrayNilai);
    } else {
      panggilan = apiCall('simpanNilaiPASBatch', AppState.token, idKelas, idMapel, idSemester, arrayNilai);
    }

    panggilan.then(function(res){
      if (res.success){ toastSukses(res.message); } else { toastGagal(res.message); }
    });
  }

  // ===================== RAPOR =====================
  function renderRapor(){
    const role = AppState.user.role;
    if (role === ROLE_SISWA){
      renderRaporUntukSiswaLangsung();
    } else if (role === ROLE_ORTU){
      renderRaporUntukOrtu();
    } else {
      renderRaporPilihSiswa();
    }
  }

  function renderRaporUntukSiswaLangsung(){
    apiCall('getSemuaSemester', AppState.token).then(function(res){
      const opsi = (res.success?res.data:[]).map(function(s){ return '<option value="'+s.ID_Semester+'">'+escapeHtmlJS(s.Nama_Semester+' - '+s.Nama_TahunAjaran)+'</option>'; }).join('');
      document.getElementById('wk-content').innerHTML =
        '<div class="wk-fade-in">' +
        '<div class="wk-card mb-3 wk-no-print"><div class="row g-2 align-items-end">' +
          '<div class="col-md-4"><label class="form-label">Semester</label><select class="form-select" id="wk-rapor-semester">'+opsi+'</select></div>' +
          '<div class="col-md-2"><button class="btn btn-primary w-100" onclick="wkTampilkanRapor(\''+AppState.user.idReferensi+'\')">Tampilkan</button></div>' +
        '</div></div>' +
        '<div id="wk-rapor-hasil"></div></div>';
    });
  }

  function renderRaporUntukOrtu(){
    apiCall('getDashboardData', AppState.token).then(function(res){
      if (!res.success || !res.data.anak || res.data.anak.length === 0){ tampilkanErrorView('Belum ada data anak yang terhubung ke akun Anda'); return; }
      const anak = res.data.anak;

      apiCall('getSemuaSemester', AppState.token).then(function(resSem){
        const opsiAnak = anak.map(function(a){ return '<option value="'+a.idSiswa+'">'+escapeHtmlJS(a.namaSiswa)+'</option>'; }).join('');
        const opsiSem = (resSem.success?resSem.data:[]).map(function(s){ return '<option value="'+s.ID_Semester+'">'+escapeHtmlJS(s.Nama_Semester+' - '+s.Nama_TahunAjaran)+'</option>'; }).join('');

        document.getElementById('wk-content').innerHTML =
          '<div class="wk-fade-in">' +
          '<div class="wk-card mb-3 wk-no-print"><div class="row g-2 align-items-end">' +
            '<div class="col-md-4"><label class="form-label">Anak</label><select class="form-select" id="wk-rapor-siswa">'+opsiAnak+'</select></div>' +
            '<div class="col-md-4"><label class="form-label">Semester</label><select class="form-select" id="wk-rapor-semester">'+opsiSem+'</select></div>' +
            '<div class="col-md-2"><button class="btn btn-primary w-100" onclick="wkTampilkanRaporDariForm()">Tampilkan</button></div>' +
          '</div></div>' +
          '<div id="wk-rapor-hasil"></div></div>';
      });
    });
  }

  function renderRaporPilihSiswa(){
    Promise.all([
      apiCall('getSemuaKelas', AppState.token),
      apiCall('getSemuaSemester', AppState.token)
    ]).then(function(hasil){
      const daftarKelas = hasil[0].success ? hasil[0].data : [];
      const daftarSemester = hasil[1].success ? hasil[1].data : [];
      const opsiKelas = daftarKelas.map(function(k){ return '<option value="'+k.id+'">'+escapeHtmlJS(k.namaKelas)+'</option>'; }).join('');
      const opsiSem = daftarSemester.map(function(s){ return '<option value="'+s.ID_Semester+'">'+escapeHtmlJS(s.Nama_Semester+' - '+s.Nama_TahunAjaran)+'</option>'; }).join('');

      document.getElementById('wk-content').innerHTML =
        '<div class="wk-fade-in">' +
        '<div class="wk-card mb-3 wk-no-print"><div class="row g-2 align-items-end">' +
          '<div class="col-md-3"><label class="form-label">Kelas</label><select class="form-select" id="wk-rapor-kelas" onchange="wkMuatSiswaUntukRapor()"><option value="">Pilih...</option>'+opsiKelas+'</select></div>' +
          '<div class="col-md-4"><label class="form-label">Siswa</label><select class="form-select" id="wk-rapor-siswa"><option value="">Pilih kelas dahulu</option></select></div>' +
          '<div class="col-md-3"><label class="form-label">Semester</label><select class="form-select" id="wk-rapor-semester"><option value="">Pilih...</option>'+opsiSem+'</select></div>' +
          '<div class="col-md-2"><button class="btn btn-primary w-100" onclick="wkTampilkanRaporDariForm()">Tampilkan</button></div>' +
        '</div></div>' +
        '<div id="wk-rapor-hasil"></div></div>';
    });
  }

  function wkMuatSiswaUntukRapor(){
    const idKelas = document.getElementById('wk-rapor-kelas').value;
    if (!idKelas) return;
    apiCall('getSemuaSiswa', AppState.token, idKelas).then(function(res){
      const sel = document.getElementById('wk-rapor-siswa');
      sel.innerHTML = '<option value="">Pilih siswa...</option>' + (res.success ? res.data.map(function(s){ return '<option value="'+s.ID_Siswa+'">'+escapeHtmlJS(s.Nama_Siswa)+'</option>'; }).join('') : '');
    });
  }

  function wkTampilkanRaporDariForm(){
    const idSiswa = document.getElementById('wk-rapor-siswa').value;
    if (!idSiswa){ toastGagal('Pilih siswa terlebih dahulu'); return; }
    wkTampilkanRapor(idSiswa);
  }

  function wkTampilkanRapor(idSiswa){
    const idSemester = document.getElementById('wk-rapor-semester').value;
    if (!idSemester){ toastGagal('Pilih semester terlebih dahulu'); return; }

    Promise.all([
      apiCall('getRaporSiswa', AppState.token, idSiswa, idSemester),
      apiCall('getSiswaById', AppState.token, idSiswa)
    ]).then(function(hasil){
      const resRapor = hasil[0], resSiswa = hasil[1];
      if (!resRapor.success){ toastGagal(resRapor.message); return; }

      if (resSiswa.success && resSiswa.data && resSiswa.data.ID_Kelas){
        apiCall('getRekapAbsensiSemester', AppState.token, resSiswa.data.ID_Kelas, idSemester).then(function(resAbsen){
          let rekapSiswa = null;
          if (resAbsen.success){
            const ditemukan = resAbsen.data.find(function(d){ return d.idSiswa === idSiswa; });
            rekapSiswa = ditemukan ? ditemukan.rekap : null;
          }
          renderIsiRapor(resRapor.data, idSiswa, idSemester, rekapSiswa);
        });
      } else {
        renderIsiRapor(resRapor.data, idSiswa, idSemester, null);
      }
    });
  }

  function renderIsiRapor(data, idSiswa, idSemester, rekapAbsensi){
    const bisaEdit = (AppState.user.role === ROLE_ADMIN || AppState.user.role === ROLE_WALI);
    const barisNilai = data.nilaiMataPelajaran.map(function(n){
      return '<tr><td>'+escapeHtmlJS(n.namaMataPelajaran)+'</td><td>'+n.rataTugas+'</td><td>'+n.rataUlangan+'</td>' +
        '<td>'+n.nilaiPTS+'</td><td>'+n.nilaiPAS+'</td><td><strong>'+n.nilaiAkhir+'</strong></td><td>'+pillStatusNilai(n.tuntas ? 'Tuntas' : 'Belum Tuntas')+'</td></tr>';
    }).join('');

    let html =
      '<div class="wk-card mb-3 wk-no-print">' +
        '<button class="btn btn-outline-primary btn-sm" onclick="window.print()"><span class="material-icons align-middle" style="font-size:16px;">print</span> Cetak / Simpan PDF</button>' +
      '</div>' +
      '<div class="wk-card mb-3">' +
        '<h5 class="mb-1">' + escapeHtmlJS(data.namaSiswa) + '</h5>' +
        '<div class="text-muted small mb-3">NIS: ' + escapeHtmlJS(data.nis) + '</div>' +
        '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Mata Pelajaran</th><th>Tugas</th><th>Ulangan</th><th>PTS</th><th>PAS</th><th>Nilai Akhir</th><th>Status</th></tr></thead>' +
        '<tbody>' + (barisNilai || '<tr><td colspan="7" class="text-center text-muted">Belum ada data nilai</td></tr>') + '</tbody></table></div>' +
      '</div>' +
      '<div class="row g-3">' +
        '<div class="col-md-6"><div class="wk-card"><div class="wk-card-title"><span class="material-icons">fact_check</span>Rekap Kehadiran (otomatis dari Absensi)</div>';

    if (rekapAbsensi){
      html += '<div class="d-flex gap-2 flex-wrap">' +
        pillBesar('Hadir', rekapAbsensi.Hadir, 'success') + pillBesar('Izin', rekapAbsensi.Izin, 'info') + pillBesar('Sakit', rekapAbsensi.Sakit, 'info') +
        pillBesar('Alpha', rekapAbsensi.Alpha, 'danger') + pillBesar('Terlambat', rekapAbsensi.Terlambat, 'warning') +
      '</div>';
    } else {
      html += kontenKosong('event_busy','Data absensi tidak tersedia');
    }

    html += '</div></div>' +
        '<div class="col-md-6"><div class="wk-card"><div class="wk-card-title"><span class="material-icons">edit_note</span>Sikap &amp; Catatan Wali Kelas</div>';

    if (bisaEdit){
      html += '<div class="mb-2"><label class="form-label">Sikap</label><input type="text" class="form-control form-control-sm" id="wk-rapor-sikap" value="'+escapeHtmlJS(data.sikap)+'"></div>' +
        '<div class="mb-2"><label class="form-label">Catatan Kehadiran (ringkasan manual, opsional)</label><input type="text" class="form-control form-control-sm" id="wk-rapor-kehadiran" value="'+escapeHtmlJS(data.kehadiran)+'"></div>' +
        '<div class="mb-2"><label class="form-label">Catatan Wali Kelas</label><textarea class="form-control form-control-sm" id="wk-rapor-catatan" rows="3">'+escapeHtmlJS(data.catatanWali)+'</textarea></div>' +
        '<div class="mb-2"><label class="form-label">Status Naik Kelas</label><select class="form-select form-select-sm" id="wk-rapor-status-naik">' +
          '<option value="">-</option><option value="Naik Kelas"'+(data.statusNaikKelas==='Naik Kelas'?' selected':'')+'>Naik Kelas</option>' +
          '<option value="Tidak Naik Kelas"'+(data.statusNaikKelas==='Tidak Naik Kelas'?' selected':'')+'>Tidak Naik Kelas</option></select></div>' +
        '<button class="btn btn-primary btn-sm wk-no-print" onclick="wkSimpanSikapRapor(\''+idSiswa+'\',\''+idSemester+'\')">Simpan</button>';
    } else {
      html += '<div class="mb-2"><span class="text-muted small">Sikap</span><div>'+escapeHtmlJS(data.sikap||'-')+'</div></div>' +
        '<div class="mb-2"><span class="text-muted small">Catatan Wali Kelas</span><div>'+escapeHtmlJS(data.catatanWali||'-')+'</div></div>' +
        '<div><span class="text-muted small">Status Naik Kelas</span><div>'+escapeHtmlJS(data.statusNaikKelas||'-')+'</div></div>';
    }

    html += '</div></div></div>';
    document.getElementById('wk-rapor-hasil').innerHTML = html;
  }

  function wkSimpanSikapRapor(idSiswa, idSemester){
    const data = {
      sikap: document.getElementById('wk-rapor-sikap').value,
      kehadiran: document.getElementById('wk-rapor-kehadiran').value,
      catatanWali: document.getElementById('wk-rapor-catatan').value,
      statusNaikKelas: document.getElementById('wk-rapor-status-naik').value
    };
    apiCall('simpanCatatanRapor', AppState.token, idSiswa, idSemester, data).then(function(res){
      if (res.success){ toastSukses(res.message); } else { toastGagal(res.message); }
    });
  }


  /* ===================== BAGIAN: KESISWAAN (PELANGGARAN, PRESTASI, CATATAN WALI) ===================== */

  // ===================== PELANGGARAN =====================
  let wkPelanggaranJenisCache = [];
  let wkModalSPInstance = null;

  function renderPelanggaran(){
    const role = AppState.user.role;
    if (role === ROLE_SISWA){
      apiCall('getRiwayatPelanggaranSiswa', AppState.token, AppState.user.idReferensi).then(function(res){
        if (!res.success){ tampilkanErrorView(res.message); return; }
        document.getElementById('wk-content').innerHTML = htmlPelanggaranReadOnly(res.data);
      });
      return;
    }
    if (role === ROLE_ORTU){
      renderPelanggaranOrtu();
      return;
    }

    const bisaKelolaJenis = (role === ROLE_ADMIN || role === ROLE_GURU_BK);
    let tabsHtml = '<button class="btn btn-sm btn-primary me-2" onclick="wkTabPelanggaran(\'siswa\')" id="wk-tab-plg-siswa">Riwayat per Siswa</button>';
    if (bisaKelolaJenis){
      tabsHtml += '<button class="btn btn-sm btn-outline-primary" onclick="wkTabPelanggaran(\'jenis\')" id="wk-tab-plg-jenis">Kelola Jenis Pelanggaran</button>';
    }

    document.getElementById('wk-content').innerHTML =
      '<div class="wk-fade-in"><div class="mb-3">' + tabsHtml + '</div><div id="wk-pelanggaran-konten"></div></div>';

    wkTabPelanggaran('siswa');
  }

  function wkTabPelanggaran(mode){
    document.getElementById('wk-tab-plg-siswa').className = 'btn btn-sm me-2 ' + (mode==='siswa'?'btn-primary':'btn-outline-primary');
    const tabJenis = document.getElementById('wk-tab-plg-jenis');
    if (tabJenis) tabJenis.className = 'btn btn-sm ' + (mode==='jenis'?'btn-primary':'btn-outline-primary');

    if (mode === 'siswa') renderPelanggaranPilihSiswa();
    else renderJenisPelanggaran();
  }

  function renderJenisPelanggaran(){
    apiCall('getSemuaJenisPelanggaran', AppState.token).then(function(res){
      if (!res.success){ document.getElementById('wk-pelanggaran-konten').innerHTML = kontenKosong('error_outline', res.message); return; }
      const data = res.data;

      wkCrudConfigAktif = {
        title:'Jenis Pelanggaran', idField:'ID_Jenis', apiSave:'simpanJenisPelanggaran', apiDelete:'hapusJenisPelanggaran',
        formFields:[
          { key:'namaPelanggaran', label:'Nama Pelanggaran', required:true },
          { key:'kategori', label:'Kategori (Ringan/Sedang/Berat)', required:true },
          { key:'poin', label:'Poin', type:'number', required:true }
        ],
        mapToForm:function(d){ return { ID_Jenis:d.ID_Jenis, namaPelanggaran:d.Nama_Pelanggaran, kategori:d.Kategori, poin:d.Poin }; }
      };
      wkListCache = data.map(wkCrudConfigAktif.mapToForm);

      const bisaHapusJenis = (AppState.user.role === ROLE_ADMIN);
      const baris = data.map(function(d, i){
        return '<tr><td>'+escapeHtmlJS(d.Nama_Pelanggaran)+'</td><td>'+escapeHtmlJS(d.Kategori)+'</td><td>'+d.Poin+'</td>' +
          '<td class="text-end"><span class="material-icons wk-row-action" onclick="wkBukaModalEditByIndex('+i+')">edit</span>' +
          (bisaHapusJenis ? '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusCrud(\''+d.ID_Jenis+'\')">delete</span>' : '') + '</td></tr>';
      }).join('');

      const tabel = '<table class="table" id="wk-dt-jenis-plg"><thead><tr><th>Nama Pelanggaran</th><th>Kategori</th><th>Poin</th><th class="text-end">Aksi</th></tr></thead><tbody>'+baris+'</tbody></table>';
      document.getElementById('wk-pelanggaran-konten').innerHTML = bungkusKontenCrud(wkCrudConfigAktif, tabel);
      wkCrudModalInstance = new bootstrap.Modal(document.getElementById('wk-crud-modal'));
      inisialisasiDataTable('#wk-dt-jenis-plg');
    });
  }

  function renderPelanggaranPilihSiswa(){
    apiCall('getSemuaKelas', AppState.token).then(function(res){
      const opsiKelas = (res.success?res.data:[]).map(function(k){ return '<option value="'+k.id+'">'+escapeHtmlJS(k.namaKelas)+'</option>'; }).join('');
      document.getElementById('wk-pelanggaran-konten').innerHTML =
        '<div class="wk-card mb-3"><div class="row g-2 align-items-end">' +
          '<div class="col-md-4"><label class="form-label">Kelas</label><select class="form-select" id="wk-plg-kelas" onchange="wkMuatSiswaPelanggaran()"><option value="">Pilih...</option>'+opsiKelas+'</select></div>' +
          '<div class="col-md-5"><label class="form-label">Siswa</label><select class="form-select" id="wk-plg-siswa" onchange="wkMuatRiwayatPelanggaran()"><option value="">Pilih kelas dahulu</option></select></div>' +
        '</div></div>' +
        '<div id="wk-plg-detail"></div>';
    });
  }

  function wkMuatSiswaPelanggaran(){
    const idKelas = document.getElementById('wk-plg-kelas').value;
    document.getElementById('wk-plg-detail').innerHTML = '';
    if (!idKelas) return;
    apiCall('getSemuaSiswa', AppState.token, idKelas).then(function(res){
      const sel = document.getElementById('wk-plg-siswa');
      sel.innerHTML = '<option value="">Pilih siswa...</option>' + (res.success?res.data.map(function(s){ return '<option value="'+s.ID_Siswa+'">'+escapeHtmlJS(s.Nama_Siswa)+'</option>'; }).join(''):'');
    });
  }

  function wkMuatRiwayatPelanggaran(){
    const idSiswa = document.getElementById('wk-plg-siswa').value;
    if (!idSiswa){ document.getElementById('wk-plg-detail').innerHTML = ''; return; }

    Promise.all([
      apiCall('getRiwayatPelanggaranSiswa', AppState.token, idSiswa),
      apiCall('getSemuaJenisPelanggaran', AppState.token),
      apiCall('getSuratPeringatanSiswa', AppState.token, idSiswa)
    ]).then(function(hasil){
      const resRiwayat = hasil[0], resJenis = hasil[1], resSP = hasil[2];
      if (!resRiwayat.success){ toastGagal(resRiwayat.message); return; }

      wkPelanggaranJenisCache = resJenis.success ? resJenis.data : [];
      const riwayat = resRiwayat.data;
      const totalPoin = riwayat.reduce(function(t, r){ return t + Number(r.Poin || 0); }, 0);
      const suratSP = resSP.success ? resSP.data : [];

      const role = AppState.user.role;
      const bisaCatat = [ROLE_ADMIN, ROLE_WALI, ROLE_GURU_BK, ROLE_GURU_MAPEL].indexOf(role) !== -1;
      const bisaHapusRiwayat = [ROLE_ADMIN, ROLE_GURU_BK].indexOf(role) !== -1;
      const bisaBuatSP = [ROLE_ADMIN, ROLE_WALI, ROLE_GURU_BK].indexOf(role) !== -1;
      const bisaHapusSP = (role === ROLE_ADMIN);

      const opsiJenis = wkPelanggaranJenisCache.map(function(j){ return '<option value="'+j.ID_Jenis+'">'+escapeHtmlJS(j.Nama_Pelanggaran)+' ('+j.Poin+' poin)</option>'; }).join('');

      const barisRiwayat = riwayat.map(function(r){
        return '<tr><td>'+formatTanggalPendekJS(r.Tanggal)+'</td><td>'+escapeHtmlJS(r.Nama_Pelanggaran)+'</td>' +
          '<td>'+r.Poin+'</td><td>'+escapeHtmlJS(r.Keterangan||'-')+'</td>' +
          '<td class="text-end">' + (bisaHapusRiwayat ? '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusRiwayatPelanggaran(\''+r.ID_Pelanggaran+'\')">delete</span>' : '') + '</td></tr>';
      }).join('');

      const barisSP = suratSP.map(function(s){
        return '<tr><td>'+formatTanggalPendekJS(s.Tanggal)+'</td><td>'+escapeHtmlJS(s.Jenis_SP)+'</td><td>'+escapeHtmlJS(s.Alasan)+'</td>' +
          '<td class="text-end">' + (bisaHapusSP ? '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusSuratPeringatan(\''+s.ID_Surat+'\')">delete</span>' : '') + '</td></tr>';
      }).join('');

      document.getElementById('wk-plg-detail').innerHTML =
        '<div class="row g-3 mb-3"><div class="col-md-4">' + statCardCol('gavel','wk-bg-danger-soft', totalPoin, 'Total Poin Pelanggaran') + '</div></div>' +
        (bisaCatat ?
        '<div class="wk-card mb-3"><div class="wk-card-title"><span class="material-icons">add_circle</span>Catat Pelanggaran Baru</div>' +
          '<div class="row g-2">' +
            '<div class="col-md-5"><select class="form-select" id="wk-plg-jenis-input"><option value="">Pilih jenis pelanggaran...</option>'+opsiJenis+'</select></div>' +
            '<div class="col-md-3"><input type="date" class="form-control" id="wk-plg-tanggal-input" value="'+formatTanggalJS(new Date())+'"></div>' +
            '<div class="col-md-3"><input type="text" class="form-control" id="wk-plg-keterangan-input" placeholder="Keterangan"></div>' +
            '<div class="col-md-1"><button class="btn btn-primary w-100" onclick="wkCatatPelanggaran(\''+idSiswa+'\')">Catat</button></div>' +
          '</div></div>' : '') +
        '<div class="wk-card mb-3 wk-table-wrap"><div class="wk-card-title"><span class="material-icons">history</span>Riwayat Pelanggaran</div>' +
          '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Tanggal</th><th>Pelanggaran</th><th>Poin</th><th>Keterangan</th><th></th></tr></thead>' +
          '<tbody>' + (barisRiwayat || '<tr><td colspan="5" class="text-center text-muted">Belum ada riwayat pelanggaran</td></tr>') + '</tbody></table></div></div>' +
        '<div class="wk-card wk-table-wrap">' +
          '<div class="d-flex justify-content-between align-items-center mb-2">' +
            '<div class="wk-card-title mb-0"><span class="material-icons">warning</span>Surat Peringatan</div>' +
            (bisaBuatSP ? '<button class="btn btn-outline-primary btn-sm" onclick="wkBukaModalSP()">Buat Surat Peringatan</button>' : '') +
          '</div>' +
          '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Alasan</th><th></th></tr></thead>' +
          '<tbody>' + (barisSP || '<tr><td colspan="4" class="text-center text-muted">Belum ada surat peringatan</td></tr>') + '</tbody></table></div>' +
        '</div>' +
        '<div class="modal fade" id="wk-modal-sp" tabindex="-1"><div class="modal-dialog"><div class="modal-content">' +
          '<div class="modal-header"><h5 class="modal-title">Buat Surat Peringatan</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>' +
          '<div class="modal-body">' +
            '<div class="mb-3"><label class="form-label">Jenis SP</label><select class="form-select" id="wk-sp-jenis"><option value="SP1">SP1</option><option value="SP2">SP2</option><option value="SP3">SP3</option></select></div>' +
            '<div class="mb-3"><label class="form-label">Tanggal</label><input type="date" class="form-control" id="wk-sp-tanggal" value="'+formatTanggalJS(new Date())+'"></div>' +
            '<div class="mb-3"><label class="form-label">Alasan</label><textarea class="form-control" id="wk-sp-alasan" rows="3"></textarea></div>' +
          '</div>' +
          '<div class="modal-footer"><button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Batal</button>' +
          '<button class="btn btn-primary btn-sm" onclick="wkSimpanSP(\''+idSiswa+'\')">Simpan</button></div>' +
        '</div></div></div>';

      wkModalSPInstance = new bootstrap.Modal(document.getElementById('wk-modal-sp'));
    });
  }

  function wkCatatPelanggaran(idSiswa){
    const idJenis = document.getElementById('wk-plg-jenis-input').value;
    const tanggal = document.getElementById('wk-plg-tanggal-input').value;
    const keterangan = document.getElementById('wk-plg-keterangan-input').value;
    if (!idJenis){ toastGagal('Pilih jenis pelanggaran terlebih dahulu'); return; }

    apiCall('catatPelanggaran', AppState.token, { idSiswa:idSiswa, idJenis:idJenis, tanggal:tanggal, keterangan:keterangan }).then(function(res){
      if (res.success){
        toastSukses(res.message);
        if (res.data && res.data.rekomendasiSP){
          Swal.fire({ icon:'warning', title:'Rekomendasi Surat Peringatan', text:'Total poin siswa telah mencapai ambang batas ' + res.data.rekomendasiSP + '.' });
        }
        wkMuatRiwayatPelanggaran();
      } else {
        toastGagal(res.message);
      }
    });
  }

  function wkHapusRiwayatPelanggaran(id){
    konfirmasiHapus().then(function(ok){
      if (!ok) return;
      apiCall('hapusPelanggaran', AppState.token, id).then(function(res){
        if (res.success){ toastSukses(res.message); wkMuatRiwayatPelanggaran(); } else { toastGagal(res.message); }
      });
    });
  }

  function wkBukaModalSP(){ wkModalSPInstance.show(); }

  function wkSimpanSP(idSiswa){
    const data = {
      idSiswa: idSiswa,
      jenisSP: document.getElementById('wk-sp-jenis').value,
      tanggal: document.getElementById('wk-sp-tanggal').value,
      alasan: document.getElementById('wk-sp-alasan').value
    };
    if (!data.alasan){ toastGagal('Alasan wajib diisi'); return; }

    apiCall('buatSuratPeringatan', AppState.token, data).then(function(res){
      if (res.success){
        wkModalSPInstance.hide();
        toastSukses(res.message);
        wkMuatRiwayatPelanggaran();
      } else {
        toastGagal(res.message);
      }
    });
  }

  function wkHapusSuratPeringatan(id){
    konfirmasiHapus().then(function(ok){
      if (!ok) return;
      apiCall('hapusSuratPeringatan', AppState.token, id).then(function(res){
        if (res.success){ toastSukses(res.message); wkMuatRiwayatPelanggaran(); } else { toastGagal(res.message); }
      });
    });
  }

  function renderPelanggaranOrtu(){
    apiCall('getDashboardData', AppState.token).then(function(res){
      if (!res.success || !res.data.anak || res.data.anak.length === 0){ tampilkanErrorView('Belum ada data anak yang terhubung ke akun Anda'); return; }
      const anak = res.data.anak;

      if (anak.length === 1){
        apiCall('getRiwayatPelanggaranSiswa', AppState.token, anak[0].idSiswa).then(function(r){
          if (r.success) document.getElementById('wk-content').innerHTML = '<h5 class="mb-3">'+escapeHtmlJS(anak[0].namaSiswa)+'</h5>' + htmlPelanggaranReadOnly(r.data);
        });
      } else {
        const opsi = anak.map(function(a){ return '<option value="'+a.idSiswa+'">'+escapeHtmlJS(a.namaSiswa)+'</option>'; }).join('');
        document.getElementById('wk-content').innerHTML =
          '<div class="wk-card mb-3"><div class="row g-2 align-items-end">' +
          '<div class="col-md-5"><label class="form-label">Pilih Anak</label><select class="form-select" id="wk-plg-ortu-anak" onchange="wkMuatPelanggaranOrtu()">'+opsi+'</select></div></div></div>' +
          '<div id="wk-plg-ortu-hasil"></div>';
        wkMuatPelanggaranOrtu();
      }
    });
  }

  function wkMuatPelanggaranOrtu(){
    const idSiswa = document.getElementById('wk-plg-ortu-anak').value;
    apiCall('getRiwayatPelanggaranSiswa', AppState.token, idSiswa).then(function(res){
      if (res.success) document.getElementById('wk-plg-ortu-hasil').innerHTML = htmlPelanggaranReadOnly(res.data);
    });
  }

  function htmlPelanggaranReadOnly(riwayat){
    const totalPoin = riwayat.reduce(function(t, r){ return t + Number(r.Poin || 0); }, 0);
    const baris = riwayat.map(function(r){
      return '<tr><td>'+formatTanggalPendekJS(r.Tanggal)+'</td><td>'+escapeHtmlJS(r.Nama_Pelanggaran)+'</td><td>'+r.Poin+'</td><td>'+escapeHtmlJS(r.Keterangan||'-')+'</td></tr>';
    }).join('');
    return '<div class="row g-3 mb-3"><div class="col-md-4">' + statCardCol('gavel','wk-bg-danger-soft', totalPoin, 'Total Poin Pelanggaran') + '</div></div>' +
      '<div class="wk-card wk-table-wrap"><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Tanggal</th><th>Pelanggaran</th><th>Poin</th><th>Keterangan</th></tr></thead>' +
      '<tbody>' + (baris || '<tr><td colspan="4" class="text-center text-muted">Belum ada riwayat pelanggaran</td></tr>') + '</tbody></table></div></div>';
  }

  // ===================== PRESTASI =====================
  function renderPrestasi(){
    const role = AppState.user.role;
    if (role === ROLE_SISWA){
      apiCall('getPrestasiSiswa', AppState.token, AppState.user.idReferensi).then(function(res){
        if (!res.success){ tampilkanErrorView(res.message); return; }
        document.getElementById('wk-content').innerHTML = htmlPrestasiReadOnly(res.data);
      });
      return;
    }
    if (role === ROLE_ORTU){
      apiCall('getDashboardData', AppState.token).then(function(res){
        if (!res.success || !res.data.anak || res.data.anak.length === 0){ tampilkanErrorView('Belum ada data anak yang terhubung ke akun Anda'); return; }
        const anak = res.data.anak;
        const opsi = anak.map(function(a){ return '<option value="'+a.idSiswa+'">'+escapeHtmlJS(a.namaSiswa)+'</option>'; }).join('');
        document.getElementById('wk-content').innerHTML =
          '<div class="wk-card mb-3"><div class="row g-2 align-items-end">' +
          '<div class="col-md-5"><label class="form-label">Pilih Anak</label><select class="form-select" id="wk-prestasi-ortu-anak" onchange="wkMuatPrestasiOrtu()">'+opsi+'</select></div></div></div>' +
          '<div id="wk-prestasi-ortu-hasil"></div>';
        wkMuatPrestasiOrtu();
      });
      return;
    }

    apiCall('getSemuaKelas', AppState.token).then(function(res){
      const opsiKelas = (res.success?res.data:[]).map(function(k){ return '<option value="'+k.id+'">'+escapeHtmlJS(k.namaKelas)+'</option>'; }).join('');
      document.getElementById('wk-content').innerHTML =
        '<div class="wk-card mb-3"><div class="row g-2 align-items-end">' +
          '<div class="col-md-4"><label class="form-label">Kelas</label><select class="form-select" id="wk-prestasi-kelas" onchange="wkMuatSiswaPrestasi()"><option value="">Pilih...</option>'+opsiKelas+'</select></div>' +
          '<div class="col-md-5"><label class="form-label">Siswa</label><select class="form-select" id="wk-prestasi-siswa" onchange="wkMuatPrestasiSiswaTerpilih()"><option value="">Pilih kelas dahulu</option></select></div>' +
        '</div></div>' +
        '<div id="wk-prestasi-detail"></div>';
    });
  }

  function wkMuatPrestasiOrtu(){
    const idSiswa = document.getElementById('wk-prestasi-ortu-anak').value;
    apiCall('getPrestasiSiswa', AppState.token, idSiswa).then(function(res){
      if (res.success) document.getElementById('wk-prestasi-ortu-hasil').innerHTML = htmlPrestasiReadOnly(res.data);
    });
  }

  function wkMuatSiswaPrestasi(){
    const idKelas = document.getElementById('wk-prestasi-kelas').value;
    document.getElementById('wk-prestasi-detail').innerHTML = '';
    if (!idKelas) return;
    apiCall('getSemuaSiswa', AppState.token, idKelas).then(function(res){
      const sel = document.getElementById('wk-prestasi-siswa');
      sel.innerHTML = '<option value="">Pilih siswa...</option>' + (res.success?res.data.map(function(s){ return '<option value="'+s.ID_Siswa+'">'+escapeHtmlJS(s.Nama_Siswa)+'</option>'; }).join(''):'');
    });
  }

  function wkMuatPrestasiSiswaTerpilih(){
    const idSiswa = document.getElementById('wk-prestasi-siswa').value;
    if (!idSiswa){ document.getElementById('wk-prestasi-detail').innerHTML = ''; return; }
    apiCall('getPrestasiSiswa', AppState.token, idSiswa).then(function(res){
      if (!res.success){ toastGagal(res.message); return; }
      const role = AppState.user.role;
      if (role === ROLE_KEPSEK || role === ROLE_WAKASEK){
        document.getElementById('wk-prestasi-detail').innerHTML = htmlPrestasiReadOnly(res.data);
      } else {
        renderPrestasiDetailEditable(res.data, idSiswa);
      }
    });
  }

  function renderPrestasiDetailEditable(data, idSiswa){
    const role = AppState.user.role;
    const bisaHapus = (role === ROLE_ADMIN || role === ROLE_WALI);
    const bisaAkademik = (role === ROLE_ADMIN || role === ROLE_WALI || role === ROLE_GURU_MAPEL);

    const baris = data.map(function(p){
      return '<tr><td>'+formatTanggalPendekJS(p.Tanggal)+'</td><td>'+escapeHtmlJS(p.Jenis)+'</td>' +
        '<td>'+escapeHtmlJS(p.Nama_Prestasi)+'</td><td>'+escapeHtmlJS(p.Tingkat)+'</td><td>'+escapeHtmlJS(p.Peringkat||'-')+'</td>' +
        '<td class="text-end">' + (bisaHapus ? '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusPrestasi(\''+p.ID_Prestasi+'\',\''+p.Jenis+'\')">delete</span>' : '') + '</td></tr>';
    }).join('');

    document.getElementById('wk-prestasi-detail').innerHTML =
      '<div class="wk-card mb-3"><div class="wk-card-title"><span class="material-icons">add_circle</span>Catat Prestasi Baru</div>' +
      '<div class="row g-2">' +
        '<div class="col-md-2"><select class="form-select" id="wk-prestasi-jenis-input">' + (bisaAkademik ? '<option value="Akademik">Akademik</option>' : '') + '<option value="NonAkademik">Non Akademik</option></select></div>' +
        '<div class="col-md-3"><input type="text" class="form-control" id="wk-prestasi-nama-input" placeholder="Nama Prestasi"></div>' +
        '<div class="col-md-2"><input type="text" class="form-control" id="wk-prestasi-tingkat-input" placeholder="Tingkat"></div>' +
        '<div class="col-md-2"><input type="text" class="form-control" id="wk-prestasi-peringkat-input" placeholder="Peringkat"></div>' +
        '<div class="col-md-2"><input type="date" class="form-control" id="wk-prestasi-tanggal-input" value="'+formatTanggalJS(new Date())+'"></div>' +
        '<div class="col-md-1"><button class="btn btn-primary w-100" onclick="wkCatatPrestasi(\''+idSiswa+'\')">Catat</button></div>' +
      '</div></div>' +
      '<div class="wk-card wk-table-wrap"><div class="table-responsive"><table class="table table-sm">' +
      '<thead><tr><th>Tanggal</th><th>Jenis</th><th>Nama Prestasi</th><th>Tingkat</th><th>Peringkat</th><th></th></tr></thead>' +
      '<tbody>' + (baris || '<tr><td colspan="6" class="text-center text-muted">Belum ada prestasi</td></tr>') + '</tbody></table></div></div>';
  }

  function wkCatatPrestasi(idSiswa){
    const jenis = document.getElementById('wk-prestasi-jenis-input').value;
    const data = {
      idSiswa: idSiswa,
      namaPrestasi: document.getElementById('wk-prestasi-nama-input').value,
      tingkat: document.getElementById('wk-prestasi-tingkat-input').value,
      peringkat: document.getElementById('wk-prestasi-peringkat-input').value,
      tanggal: document.getElementById('wk-prestasi-tanggal-input').value
    };
    if (!data.namaPrestasi || !data.tingkat){ toastGagal('Nama prestasi dan tingkat wajib diisi'); return; }

    const fungsi = jenis === 'Akademik' ? 'catatPrestasiAkademik' : 'catatPrestasiNonAkademik';
    apiCall(fungsi, AppState.token, data).then(function(res){
      if (res.success){ toastSukses(res.message); wkMuatPrestasiSiswaTerpilih(); } else { toastGagal(res.message); }
    });
  }

  function wkHapusPrestasi(id, jenis){
    konfirmasiHapus().then(function(ok){
      if (!ok) return;
      const fungsi = jenis === 'Akademik' ? 'hapusPrestasiAkademik' : 'hapusPrestasiNonAkademik';
      apiCall(fungsi, AppState.token, id).then(function(res){
        if (res.success){ toastSukses(res.message); wkMuatPrestasiSiswaTerpilih(); } else { toastGagal(res.message); }
      });
    });
  }

  function htmlPrestasiReadOnly(data){
    const baris = data.map(function(p){
      return '<tr><td>'+formatTanggalPendekJS(p.Tanggal)+'</td><td>'+escapeHtmlJS(p.Jenis)+'</td><td>'+escapeHtmlJS(p.Nama_Prestasi)+'</td>' +
        '<td>'+escapeHtmlJS(p.Tingkat)+'</td><td>'+escapeHtmlJS(p.Peringkat||'-')+'</td></tr>';
    }).join('');
    return '<div class="wk-card wk-table-wrap"><div class="table-responsive"><table class="table table-sm">' +
      '<thead><tr><th>Tanggal</th><th>Jenis</th><th>Nama Prestasi</th><th>Tingkat</th><th>Peringkat</th></tr></thead>' +
      '<tbody>' + (baris || '<tr><td colspan="5" class="text-center text-muted">Belum ada prestasi</td></tr>') + '</tbody></table></div></div>';
  }

  // ===================== CATATAN WALI KELAS =====================
  const wkCatatanWaliState = { idSiswa:null, mode:'catatan' };

  function renderCatatanWali(){
    apiCall('getSemuaKelas', AppState.token).then(function(res){
      const opsiKelas = (res.success?res.data:[]).map(function(k){ return '<option value="'+k.id+'">'+escapeHtmlJS(k.namaKelas)+'</option>'; }).join('');

      document.getElementById('wk-content').innerHTML =
        '<div class="wk-fade-in">' +
        '<div class="wk-card mb-3"><div class="row g-2 align-items-end">' +
          '<div class="col-md-4"><label class="form-label">Kelas</label><select class="form-select" id="wk-cw-kelas" onchange="wkMuatSiswaCatatanWali()"><option value="">Pilih...</option>'+opsiKelas+'</select></div>' +
          '<div class="col-md-5"><label class="form-label">Siswa</label><select class="form-select" id="wk-cw-siswa" onchange="wkMuatTabCatatanWali()"><option value="">Pilih kelas dahulu</option></select></div>' +
        '</div></div>' +
        '<div id="wk-cw-tabs" class="mb-3" style="display:none;">' +
          '<button class="btn btn-sm btn-primary me-2" onclick="wkTabCatatanWali(\'catatan\')" id="wk-tab-cw-catatan">Catatan</button>' +
          '<button class="btn btn-sm btn-outline-primary me-2" onclick="wkTabCatatanWali(\'konseling\')" id="wk-tab-cw-konseling">Konseling</button>' +
          '<button class="btn btn-sm btn-outline-primary" onclick="wkTabCatatanWali(\'komunikasi\')" id="wk-tab-cw-komunikasi">Komunikasi Ortu</button>' +
        '</div>' +
        '<div id="wk-cw-detail"></div>' +
        '</div>';
    });
  }

  function wkMuatSiswaCatatanWali(){
    const idKelas = document.getElementById('wk-cw-kelas').value;
    document.getElementById('wk-cw-tabs').style.display = 'none';
    document.getElementById('wk-cw-detail').innerHTML = '';
    if (!idKelas) return;
    apiCall('getSemuaSiswa', AppState.token, idKelas).then(function(res){
      const sel = document.getElementById('wk-cw-siswa');
      sel.innerHTML = '<option value="">Pilih siswa...</option>' + (res.success?res.data.map(function(s){ return '<option value="'+s.ID_Siswa+'">'+escapeHtmlJS(s.Nama_Siswa)+'</option>'; }).join(''):'');
    });
  }

  function wkMuatTabCatatanWali(){
    const idSiswa = document.getElementById('wk-cw-siswa').value;
    wkCatatanWaliState.idSiswa = idSiswa;
    if (!idSiswa){ document.getElementById('wk-cw-tabs').style.display='none'; document.getElementById('wk-cw-detail').innerHTML=''; return; }
    document.getElementById('wk-cw-tabs').style.display = 'block';

    // Guru BK tidak diizinkan backend untuk tab Catatan (simpan/hapus) maupun
    // Komunikasi Ortu (bahkan untuk melihat), jadi kedua tab disembunyikan
    // dan mereka langsung diarahkan ke tab Konseling (domain penuh mereka).
    const role = AppState.user.role;
    const isGuruBK = (role === ROLE_GURU_BK);
    document.getElementById('wk-tab-cw-catatan').style.display = isGuruBK ? 'none' : 'inline-block';
    document.getElementById('wk-tab-cw-komunikasi').style.display = isGuruBK ? 'none' : 'inline-block';
    wkTabCatatanWali(isGuruBK ? 'konseling' : 'catatan');
  }

  function wkTabCatatanWali(mode){
    wkCatatanWaliState.mode = mode;
    ['catatan','konseling','komunikasi'].forEach(function(m){
      document.getElementById('wk-tab-cw-'+m).className = 'btn btn-sm me-2 ' + (m===mode?'btn-primary':'btn-outline-primary');
    });

    const idSiswa = wkCatatanWaliState.idSiswa;
    if (mode === 'catatan'){
      apiCall('getCatatanSiswa', AppState.token, idSiswa).then(function(res){ if (res.success) renderTabCatatan(res.data, idSiswa); });
    } else if (mode === 'konseling'){
      apiCall('getKonselingSiswa', AppState.token, idSiswa).then(function(res){ if (res.success) renderTabKonseling(res.data, idSiswa); });
    } else {
      apiCall('getKomunikasiOrtu', AppState.token, idSiswa).then(function(res){ if (res.success) renderTabKomunikasi(res.data, idSiswa); });
    }
  }

  function renderTabCatatan(data, idSiswa){
    const baris = data.map(function(c){
      return '<tr><td>'+formatTanggalPendekJS(c.Tanggal)+'</td><td>'+escapeHtmlJS(c.Kategori)+'</td><td>'+escapeHtmlJS(c.Isi_Catatan)+'</td>' +
        '<td class="text-end"><span class="material-icons wk-row-action wk-danger" onclick="wkHapusCatatan(\''+c.ID_Catatan+'\')">delete</span></td></tr>';
    }).join('');

    document.getElementById('wk-cw-detail').innerHTML =
      '<div class="wk-card mb-3"><div class="wk-card-title"><span class="material-icons">add_circle</span>Tambah Catatan</div>' +
      '<div class="row g-2">' +
        '<div class="col-md-3"><input type="text" class="form-control" id="wk-catatan-kategori" placeholder="Kategori"></div>' +
        '<div class="col-md-6"><input type="text" class="form-control" id="wk-catatan-isi" placeholder="Isi catatan"></div>' +
        '<div class="col-md-2"><input type="date" class="form-control" id="wk-catatan-tanggal" value="'+formatTanggalJS(new Date())+'"></div>' +
        '<div class="col-md-1"><button class="btn btn-primary w-100" onclick="wkTambahCatatan(\''+idSiswa+'\')">Simpan</button></div>' +
      '</div></div>' +
      '<div class="wk-card wk-table-wrap"><div class="table-responsive"><table class="table table-sm">' +
      '<thead><tr><th>Tanggal</th><th>Kategori</th><th>Isi Catatan</th><th></th></tr></thead>' +
      '<tbody>' + (baris || '<tr><td colspan="4" class="text-center text-muted">Belum ada catatan</td></tr>') + '</tbody></table></div></div>';
  }

  function wkTambahCatatan(idSiswa){
    const data = {
      idSiswa: idSiswa,
      kategori: document.getElementById('wk-catatan-kategori').value || 'Umum',
      isiCatatan: document.getElementById('wk-catatan-isi').value,
      tanggal: document.getElementById('wk-catatan-tanggal').value
    };
    if (!data.isiCatatan){ toastGagal('Isi catatan wajib diisi'); return; }
    apiCall('simpanCatatanSiswa', AppState.token, data).then(function(res){
      if (res.success){ toastSukses(res.message); wkTabCatatanWali('catatan'); } else { toastGagal(res.message); }
    });
  }

  function wkHapusCatatan(id){
    konfirmasiHapus().then(function(ok){
      if (!ok) return;
      apiCall('hapusCatatanSiswa', AppState.token, id).then(function(res){
        if (res.success){ toastSukses(res.message); wkTabCatatanWali('catatan'); } else { toastGagal(res.message); }
      });
    });
  }

  function renderTabKonseling(data, idSiswa){
    const bisaHapus = (AppState.user.role === ROLE_ADMIN || AppState.user.role === ROLE_GURU_BK);
    const baris = data.map(function(k){
      return '<tr><td>'+formatTanggalPendekJS(k.Tanggal)+'</td><td>'+escapeHtmlJS(k.Masalah)+'</td><td>'+escapeHtmlJS(k.Tindak_Lanjut||'-')+'</td>' +
        '<td class="text-end">' + (bisaHapus ? '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusKonseling(\''+k.ID_Konseling+'\')">delete</span>' : '') + '</td></tr>';
    }).join('');

    document.getElementById('wk-cw-detail').innerHTML =
      '<div class="wk-card mb-3"><div class="wk-card-title"><span class="material-icons">add_circle</span>Tambah Data Konseling</div>' +
      '<div class="row g-2">' +
        '<div class="col-md-4"><input type="text" class="form-control" id="wk-konseling-masalah" placeholder="Masalah"></div>' +
        '<div class="col-md-4"><input type="text" class="form-control" id="wk-konseling-tindak" placeholder="Tindak Lanjut"></div>' +
        '<div class="col-md-2"><input type="date" class="form-control" id="wk-konseling-tanggal" value="'+formatTanggalJS(new Date())+'"></div>' +
        '<div class="col-md-2"><button class="btn btn-primary w-100" onclick="wkTambahKonseling(\''+idSiswa+'\')">Simpan</button></div>' +
      '</div></div>' +
      '<div class="wk-card wk-table-wrap"><div class="table-responsive"><table class="table table-sm">' +
      '<thead><tr><th>Tanggal</th><th>Masalah</th><th>Tindak Lanjut</th><th></th></tr></thead>' +
      '<tbody>' + (baris || '<tr><td colspan="4" class="text-center text-muted">Belum ada data konseling</td></tr>') + '</tbody></table></div></div>';
  }

  function wkTambahKonseling(idSiswa){
    const data = {
      idSiswa: idSiswa,
      masalah: document.getElementById('wk-konseling-masalah').value,
      tindakLanjut: document.getElementById('wk-konseling-tindak').value,
      tanggal: document.getElementById('wk-konseling-tanggal').value
    };
    if (!data.masalah){ toastGagal('Masalah wajib diisi'); return; }
    apiCall('simpanKonseling', AppState.token, data).then(function(res){
      if (res.success){ toastSukses(res.message); wkTabCatatanWali('konseling'); } else { toastGagal(res.message); }
    });
  }

  function wkHapusKonseling(id){
    konfirmasiHapus().then(function(ok){
      if (!ok) return;
      apiCall('hapusKonseling', AppState.token, id).then(function(res){
        if (res.success){ toastSukses(res.message); wkTabCatatanWali('konseling'); } else { toastGagal(res.message); }
      });
    });
  }

  function renderTabKomunikasi(data, idSiswa){
    const baris = data.map(function(k){
      return '<tr><td>'+formatTanggalPendekJS(k.Tanggal)+'</td><td>'+escapeHtmlJS(k.Media)+'</td><td>'+escapeHtmlJS(k.Isi)+'</td>' +
        '<td class="text-end"><span class="material-icons wk-row-action wk-danger" onclick="wkHapusKomunikasi(\''+k.ID_Komunikasi+'\')">delete</span></td></tr>';
    }).join('');

    document.getElementById('wk-cw-detail').innerHTML =
      '<div class="wk-card mb-3"><div class="wk-card-title"><span class="material-icons">add_circle</span>Tambah Komunikasi</div>' +
      '<div class="row g-2">' +
        '<div class="col-md-3"><select class="form-select" id="wk-komunikasi-media"><option value="Telepon">Telepon</option><option value="WhatsApp">WhatsApp</option><option value="Tatap Muka">Tatap Muka</option></select></div>' +
        '<div class="col-md-5"><input type="text" class="form-control" id="wk-komunikasi-isi" placeholder="Isi komunikasi"></div>' +
        '<div class="col-md-2"><input type="date" class="form-control" id="wk-komunikasi-tanggal" value="'+formatTanggalJS(new Date())+'"></div>' +
        '<div class="col-md-2"><button class="btn btn-primary w-100" onclick="wkTambahKomunikasi(\''+idSiswa+'\')">Simpan</button></div>' +
      '</div></div>' +
      '<div class="wk-card wk-table-wrap"><div class="table-responsive"><table class="table table-sm">' +
      '<thead><tr><th>Tanggal</th><th>Media</th><th>Isi</th><th></th></tr></thead>' +
      '<tbody>' + (baris || '<tr><td colspan="4" class="text-center text-muted">Belum ada data komunikasi</td></tr>') + '</tbody></table></div></div>';
  }

  function wkTambahKomunikasi(idSiswa){
    const data = {
      idSiswa: idSiswa,
      media: document.getElementById('wk-komunikasi-media').value,
      isi: document.getElementById('wk-komunikasi-isi').value,
      tanggal: document.getElementById('wk-komunikasi-tanggal').value
    };
    if (!data.isi){ toastGagal('Isi komunikasi wajib diisi'); return; }
    apiCall('simpanKomunikasiOrtu', AppState.token, data).then(function(res){
      if (res.success){ toastSukses(res.message); wkTabCatatanWali('komunikasi'); } else { toastGagal(res.message); }
    });
  }

  function wkHapusKomunikasi(id){
    konfirmasiHapus().then(function(ok){
      if (!ok) return;
      apiCall('hapusKomunikasiOrtu', AppState.token, id).then(function(res){
        if (res.success){ toastSukses(res.message); wkTabCatatanWali('komunikasi'); } else { toastGagal(res.message); }
      });
    });
  }


  /* ===================== BAGIAN: PENGUMUMAN, KALENDER, LAPORAN, PENGATURAN ===================== */

  // ===================== PENGUMUMAN =====================
  let wkModalPengumumanInstance = null;
  let wkPengumumanCache = [];

  function renderPengumuman(){
    const role = AppState.user.role;
    const bisaBuat = [ROLE_ADMIN, ROLE_KEPSEK, ROLE_WAKASEK, ROLE_WALI, ROLE_GURU_MAPEL, ROLE_GURU_BK].indexOf(role) !== -1;

    apiCall('getPengumumanUntukSaya', AppState.token).then(function(res){
      if (!res.success){ tampilkanErrorView(res.message); return; }
      const data = res.data;
      wkPengumumanCache = data;

      const daftarHtml = data.map(function(p){
        const bisaKelola = bisaBuat && (p.ID_Pembuat === AppState.user.id || role === ROLE_ADMIN);
        return '<div class="wk-card mb-2"><div class="d-flex justify-content-between align-items-start">' +
            '<div>' +
              '<div style="font-weight:600;">' + escapeHtmlJS(p.Judul) + '</div>' +
              '<div class="text-muted small mb-2">' + formatTanggalIndoJS(p.Tanggal_Publish) + ' &middot; Target: ' + escapeHtmlJS(p.Target_Role) + '</div>' +
              '<div style="white-space:pre-wrap;">' + escapeHtmlJS(p.Isi) + '</div>' +
              (p.Lampiran_URL ? '<a href="' + p.Lampiran_URL + '" target="_blank" class="d-inline-flex align-items-center gap-1 mt-2 small"><span class="material-icons" style="font-size:16px;">attach_file</span>Lihat Lampiran</a>' : '') +
            '</div>' +
            (bisaKelola ? '<div class="flex-shrink-0"><span class="material-icons wk-row-action" onclick="wkEditPengumuman(\'' + p.ID_Pengumuman + '\')">edit</span>' +
              '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusPengumuman(\'' + p.ID_Pengumuman + '\')">delete</span></div>' : '') +
          '</div></div>';
      }).join('');

      let html = '<div class="wk-fade-in">';
      if (bisaBuat){
        html += '<div class="mb-3 text-end"><button class="btn btn-primary btn-sm" onclick="wkBukaModalPengumuman()">' +
          '<span class="material-icons align-middle" style="font-size:16px;">add</span> Buat Pengumuman</button></div>';
      }
      html += data.length ? daftarHtml : ('<div class="wk-card">' + kontenKosong('campaign','Belum ada pengumuman') + '</div>');
      html += '</div>' + htmlModalPengumuman();

      document.getElementById('wk-content').innerHTML = html;
      wkModalPengumumanInstance = new bootstrap.Modal(document.getElementById('wk-modal-pengumuman'));
    });
  }

  function htmlModalPengumuman(){
    return '<div class="modal fade" id="wk-modal-pengumuman" tabindex="-1"><div class="modal-dialog"><div class="modal-content">' +
      '<div class="modal-header"><h5 class="modal-title" id="wk-modal-pengumuman-title">Buat Pengumuman</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>' +
      '<div class="modal-body">' +
        '<input type="hidden" id="wk-pengumuman-id">' +
        '<div class="mb-3"><label class="form-label">Judul</label><input type="text" class="form-control" id="wk-pengumuman-judul"></div>' +
        '<div class="mb-3"><label class="form-label">Isi</label><textarea class="form-control" id="wk-pengumuman-isi" rows="4"></textarea></div>' +
        '<div class="mb-3"><label class="form-label">Target</label><select class="form-select" id="wk-pengumuman-target">' +
          '<option value="Semua">Semua</option><option value="Wali Kelas">Wali Kelas</option>' +
          '<option value="Guru Mata Pelajaran">Guru Mata Pelajaran</option><option value="Guru BK">Guru BK</option>' +
          '<option value="Siswa">Siswa</option><option value="Orang Tua">Orang Tua</option>' +
        '</select></div>' +
        '<div class="mb-3"><label class="form-label">Lampiran (opsional)</label><input type="file" class="form-control" id="wk-pengumuman-file">' +
          '<input type="hidden" id="wk-pengumuman-lampiran-url"></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Batal</button>' +
      '<button class="btn btn-primary btn-sm" onclick="wkSimpanPengumuman()">Simpan</button></div>' +
    '</div></div></div>';
  }

  function wkBukaModalPengumuman(){
    document.getElementById('wk-pengumuman-id').value = '';
    document.getElementById('wk-pengumuman-judul').value = '';
    document.getElementById('wk-pengumuman-isi').value = '';
    document.getElementById('wk-pengumuman-target').value = 'Semua';
    document.getElementById('wk-pengumuman-lampiran-url').value = '';
    document.getElementById('wk-pengumuman-file').value = '';
    document.getElementById('wk-modal-pengumuman-title').innerText = 'Buat Pengumuman';
    wkModalPengumumanInstance.show();
  }

  function wkEditPengumuman(id){
    const p = wkPengumumanCache.find(function(x){ return x.ID_Pengumuman === id; });
    if (!p) return;
    document.getElementById('wk-pengumuman-id').value = p.ID_Pengumuman;
    document.getElementById('wk-pengumuman-judul').value = p.Judul;
    document.getElementById('wk-pengumuman-isi').value = p.Isi;
    document.getElementById('wk-pengumuman-target').value = p.Target_Role;
    document.getElementById('wk-pengumuman-lampiran-url').value = p.Lampiran_URL || '';
    document.getElementById('wk-pengumuman-file').value = '';
    document.getElementById('wk-modal-pengumuman-title').innerText = 'Ubah Pengumuman';
    wkModalPengumumanInstance.show();
  }

  function wkSimpanPengumuman(){
    const fileInput = document.getElementById('wk-pengumuman-file');
    const file = fileInput.files[0];

    const lanjutSimpan = function(lampiranUrl){
      const data = {
        id: document.getElementById('wk-pengumuman-id').value || undefined,
        judul: document.getElementById('wk-pengumuman-judul').value,
        isi: document.getElementById('wk-pengumuman-isi').value,
        targetRole: document.getElementById('wk-pengumuman-target').value,
        lampiranUrl: lampiranUrl
      };
      if (!data.judul || !data.isi){ toastGagal('Judul dan isi wajib diisi'); return; }

      apiCall('simpanPengumuman', AppState.token, data).then(function(res){
        if (res.success){
          wkModalPengumumanInstance.hide();
          toastSukses(res.message);
          navigateTo('pengumuman');
        } else {
          toastGagal(res.message);
        }
      });
    };

    if (file){
      const reader = new FileReader();
      reader.onload = function(){
        const base64 = reader.result.split(',')[1];
        apiCall('uploadFile', AppState.token, base64, file.name, file.type, 'Pengumuman').then(function(res){
          if (res.success){ lanjutSimpan(res.data.url); } else { toastGagal(res.message); }
        });
      };
      reader.readAsDataURL(file);
    } else {
      lanjutSimpan(document.getElementById('wk-pengumuman-lampiran-url').value);
    }
  }

  function wkHapusPengumuman(id){
    konfirmasiHapus().then(function(ok){
      if (!ok) return;
      apiCall('hapusPengumuman', AppState.token, id).then(function(res){
        if (res.success){ toastSukses(res.message); navigateTo('pengumuman'); } else { toastGagal(res.message); }
      });
    });
  }

  // ===================== KALENDER AKADEMIK =====================
  const wkKalenderState = { bulan: new Date().getMonth(), tahun: new Date().getFullYear() };
  let wkModalKalenderInstance = null;
  let wkKalenderCache = [];

  function renderKalender(){
    document.getElementById('wk-content').innerHTML = '<div id="wk-kalender-wrap"></div>';
    muatKalender();
  }

  function muatKalender(){
    apiCall('getKalenderByBulan', AppState.token, wkKalenderState.bulan, wkKalenderState.tahun).then(function(res){
      if (!res.success){ tampilkanErrorView(res.message); return; }
      renderGridKalender(res.data);
    });
  }

  function gantiBulanKalender(delta){
    wkKalenderState.bulan += delta;
    if (wkKalenderState.bulan > 11){ wkKalenderState.bulan = 0; wkKalenderState.tahun++; }
    if (wkKalenderState.bulan < 0){ wkKalenderState.bulan = 11; wkKalenderState.tahun--; }
    muatKalender();
  }

  function renderGridKalender(events){
    const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const bisaKelola = [ROLE_ADMIN, ROLE_KEPSEK, ROLE_WAKASEK].indexOf(AppState.user.role) !== -1;

    const tglAwal = new Date(wkKalenderState.tahun, wkKalenderState.bulan, 1);
    const jumlahHari = new Date(wkKalenderState.tahun, wkKalenderState.bulan + 1, 0).getDate();
    const hariMulaiOffset = tglAwal.getDay();

    let selHari = [];
    for (let i = 0; i < hariMulaiOffset; i++) selHari.push('<div class="wk-kal-cell wk-kal-kosong"></div>');
    for (let d = 1; d <= jumlahHari; d++){
      const pad2 = function(n){ return (n<10?'0':'')+n; };
      const tglStr = wkKalenderState.tahun + '-' + pad2(wkKalenderState.bulan+1) + '-' + pad2(d);
      const eventHariIni = events.filter(function(e){
        const mulai = formatTanggalJS(e.Tanggal_Mulai);
        const selesai = formatTanggalJS(e.Tanggal_Selesai || e.Tanggal_Mulai);
        return tglStr >= mulai && tglStr <= selesai;
      });
      const badgeHtml = eventHariIni.map(function(e){
        const kelasPill = e.Jenis === 'Libur' ? 'wk-pill-alpha' : e.Jenis === 'Ujian' ? 'wk-pill-terlambat' : 'wk-pill-izin';
        return '<div class="wk-pill ' + kelasPill + '" style="display:block;margin-bottom:2px;font-size:.65rem;" title="'+escapeHtmlJS(e.Judul)+'">'+escapeHtmlJS(e.Judul)+'</div>';
      }).join('');
      selHari.push('<div class="wk-kal-cell"><div class="wk-kal-tanggal">'+d+'</div>'+badgeHtml+'</div>');
    }

    const html =
      '<div class="wk-fade-in">' +
        '<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">' +
          '<div class="d-flex align-items-center gap-2">' +
            '<button class="btn btn-outline-primary btn-sm" onclick="gantiBulanKalender(-1)"><span class="material-icons" style="font-size:16px;">chevron_left</span></button>' +
            '<h5 class="mb-0">'+namaBulan[wkKalenderState.bulan]+' '+wkKalenderState.tahun+'</h5>' +
            '<button class="btn btn-outline-primary btn-sm" onclick="gantiBulanKalender(1)"><span class="material-icons" style="font-size:16px;">chevron_right</span></button>' +
          '</div>' +
          (bisaKelola ? '<button class="btn btn-primary btn-sm" onclick="wkBukaModalKalender()"><span class="material-icons align-middle" style="font-size:16px;">add</span> Tambah Kegiatan</button>' : '') +
        '</div>' +
        '<div class="wk-card">' +
          '<div class="wk-kal-grid wk-kal-header"><div>Min</div><div>Sen</div><div>Sel</div><div>Rab</div><div>Kam</div><div>Jum</div><div>Sab</div></div>' +
          '<div class="wk-kal-grid">' + selHari.join('') + '</div>' +
        '</div>' +
        (bisaKelola ? '<div class="wk-card mt-3"><div class="wk-card-title"><span class="material-icons">list</span>Daftar Kegiatan Bulan Ini</div>' + renderDaftarKalenderList(events) + '</div>' : '') +
      '</div>';

    document.getElementById('wk-kalender-wrap').innerHTML = html + htmlModalKalender();
    wkModalKalenderInstance = new bootstrap.Modal(document.getElementById('wk-modal-kalender'));
    wkKalenderCache = events;
  }

  function renderDaftarKalenderList(events){
    if (events.length === 0) return kontenKosong('event_busy','Belum ada kegiatan bulan ini');
    return events.map(function(e){
      return '<div class="wk-list-item"><span class="material-icons text-muted" style="font-size:18px;">event</span>' +
        '<div class="flex-grow-1"><div style="font-size:.85rem;font-weight:500;">'+escapeHtmlJS(e.Judul)+' <span class="text-muted">('+escapeHtmlJS(e.Jenis)+')</span></div>' +
        '<div class="text-muted" style="font-size:.75rem;">'+formatTanggalPendekJS(e.Tanggal_Mulai)+' - '+formatTanggalPendekJS(e.Tanggal_Selesai)+'</div></div>' +
        '<span class="material-icons wk-row-action" onclick="wkEditKalender(\''+e.ID_Kalender+'\')">edit</span>' +
        '<span class="material-icons wk-row-action wk-danger" onclick="wkHapusKalender(\''+e.ID_Kalender+'\')">delete</span></div>';
    }).join('');
  }

  function htmlModalKalender(){
    return '<div class="modal fade" id="wk-modal-kalender" tabindex="-1"><div class="modal-dialog"><div class="modal-content">' +
      '<div class="modal-header"><h5 class="modal-title" id="wk-modal-kalender-title">Tambah Kegiatan</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>' +
      '<div class="modal-body">' +
        '<input type="hidden" id="wk-kalender-id">' +
        '<div class="mb-3"><label class="form-label">Judul</label><input type="text" class="form-control" id="wk-kalender-judul"></div>' +
        '<div class="mb-3"><label class="form-label">Jenis</label><select class="form-select" id="wk-kalender-jenis">' +
          '<option value="Libur">Libur</option><option value="Ujian">Ujian</option><option value="Kegiatan">Kegiatan</option></select></div>' +
        '<div class="row"><div class="col-6 mb-3"><label class="form-label">Tanggal Mulai</label><input type="date" class="form-control" id="wk-kalender-mulai"></div>' +
        '<div class="col-6 mb-3"><label class="form-label">Tanggal Selesai</label><input type="date" class="form-control" id="wk-kalender-selesai"></div></div>' +
        '<div class="mb-3"><label class="form-label">Keterangan</label><textarea class="form-control" id="wk-kalender-keterangan" rows="2"></textarea></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Batal</button>' +
      '<button class="btn btn-primary btn-sm" onclick="wkSimpanKalender()">Simpan</button></div>' +
    '</div></div></div>';
  }

  function wkBukaModalKalender(){
    ['id','judul','mulai','selesai','keterangan'].forEach(function(f){ document.getElementById('wk-kalender-'+f).value=''; });
    document.getElementById('wk-kalender-jenis').value = 'Libur';
    document.getElementById('wk-modal-kalender-title').innerText = 'Tambah Kegiatan';
    wkModalKalenderInstance.show();
  }

  function wkEditKalender(id){
    const e = wkKalenderCache.find(function(x){ return x.ID_Kalender === id; });
    if (!e) return;
    document.getElementById('wk-kalender-id').value = e.ID_Kalender;
    document.getElementById('wk-kalender-judul').value = e.Judul;
    document.getElementById('wk-kalender-jenis').value = e.Jenis;
    document.getElementById('wk-kalender-mulai').value = formatTanggalJS(e.Tanggal_Mulai);
    document.getElementById('wk-kalender-selesai').value = formatTanggalJS(e.Tanggal_Selesai);
    document.getElementById('wk-kalender-keterangan').value = e.Keterangan || '';
    document.getElementById('wk-modal-kalender-title').innerText = 'Ubah Kegiatan';
    wkModalKalenderInstance.show();
  }

  function wkSimpanKalender(){
    const data = {
      id: document.getElementById('wk-kalender-id').value || undefined,
      judul: document.getElementById('wk-kalender-judul').value,
      jenis: document.getElementById('wk-kalender-jenis').value,
      tanggalMulai: document.getElementById('wk-kalender-mulai').value,
      tanggalSelesai: document.getElementById('wk-kalender-selesai').value,
      keterangan: document.getElementById('wk-kalender-keterangan').value
    };
    if (!data.judul || !data.tanggalMulai){ toastGagal('Judul dan tanggal mulai wajib diisi'); return; }

    apiCall('simpanKalender', AppState.token, data).then(function(res){
      if (res.success){
        wkModalKalenderInstance.hide();
        toastSukses(res.message);
        muatKalender();
      } else {
        toastGagal(res.message);
      }
    });
  }

  function wkHapusKalender(id){
    konfirmasiHapus().then(function(ok){
      if (!ok) return;
      apiCall('hapusKalender', AppState.token, id).then(function(res){
        if (res.success){ toastSukses(res.message); muatKalender(); } else { toastGagal(res.message); }
      });
    });
  }

  // ===================== LAPORAN =====================
  function renderLaporan(){
    Promise.all([
      apiCall('getKelasUntukLaporan', AppState.token),
      apiCall('getSemuaSemester', AppState.token)
    ]).then(function(hasil){
      const resKelas = hasil[0], resSem = hasil[1];
      if (!resKelas.success){ tampilkanErrorView(resKelas.message); return; }

      const opsiKelas = resKelas.data.map(function(k){ return '<option value="'+k.ID_Kelas+'">'+escapeHtmlJS(k.Nama_Kelas)+'</option>'; }).join('');
      const opsiSem = (resSem.success?resSem.data:[]).map(function(s){ return '<option value="'+s.ID_Semester+'">'+escapeHtmlJS(s.Nama_Semester+' - '+s.Nama_TahunAjaran)+'</option>'; }).join('');

      document.getElementById('wk-content').innerHTML =
        '<div class="wk-fade-in">' +
        '<div class="wk-card mb-3 wk-no-print"><div class="row g-2 align-items-end">' +
          '<div class="col-md-3"><label class="form-label">Jenis Laporan</label><select class="form-select" id="wk-laporan-jenis">' +
            '<option value="rekap-kelas">Rekap Per Kelas (Nilai, Pelanggaran, Prestasi)</option>' +
            '<option value="absensi">Rekap Absensi Semester</option>' +
            '<option value="pelanggaran">Rekap Pelanggaran</option>' +
            '<option value="prestasi">Rekap Prestasi</option>' +
          '</select></div>' +
          '<div class="col-md-3"><label class="form-label">Kelas</label><select class="form-select" id="wk-laporan-kelas"><option value="">Pilih...</option>'+opsiKelas+'</select></div>' +
          '<div class="col-md-3"><label class="form-label">Semester</label><select class="form-select" id="wk-laporan-semester"><option value="">Pilih...</option>'+opsiSem+'</select></div>' +
          '<div class="col-md-3"><button class="btn btn-primary w-100" onclick="wkMuatLaporan()">Tampilkan</button></div>' +
        '</div></div>' +
        '<div id="wk-laporan-hasil"></div>' +
        '</div>';
    });
  }

  function wkMuatLaporan(){
    const jenis = document.getElementById('wk-laporan-jenis').value;
    const idKelas = document.getElementById('wk-laporan-kelas').value;
    const idSemester = document.getElementById('wk-laporan-semester').value;

    if (!idKelas){ toastGagal('Pilih kelas terlebih dahulu'); return; }
    if ((jenis === 'rekap-kelas' || jenis === 'absensi') && !idSemester){ toastGagal('Pilih semester terlebih dahulu'); return; }

    if (jenis === 'rekap-kelas'){
      apiCall('getLaporanRekapKelas', AppState.token, idKelas, idSemester).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderLaporanRekapKelas(res.data);
      });
    } else if (jenis === 'absensi'){
      apiCall('getRekapAbsensiSemester', AppState.token, idKelas, idSemester).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderLaporanAbsensi(res.data);
      });
    } else if (jenis === 'pelanggaran'){
      apiCall('getRiwayatPelanggaranKelas', AppState.token, idKelas).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderLaporanPelanggaran(agregasiPelanggaranPerSiswa(res.data));
      });
    } else {
      apiCall('getPrestasiKelas', AppState.token, idKelas).then(function(res){
        if (!res.success){ toastGagal(res.message); return; }
        renderLaporanPrestasi(agregasiPrestasiPerSiswa(res.data));
      });
    }
  }

  /**
   * getRiwayatPelanggaranKelas mengembalikan daftar per KEJADIAN pelanggaran
   * (bukan rekap per siswa), sehingga perlu diagregasi dulu di sisi frontend.
   */
  function agregasiPelanggaranPerSiswa(daftarKejadian){
    const peta = {};
    daftarKejadian.forEach(function(r){
      if (!peta[r.idSiswa]) peta[r.idSiswa] = { namaSiswa: r.namaSiswa, jumlahPelanggaran: 0, totalPoin: 0 };
      peta[r.idSiswa].jumlahPelanggaran++;
      peta[r.idSiswa].totalPoin += Number(r.poin || 0);
    });
    const hasil = Object.keys(peta).map(function(id){ return peta[id]; });
    return hasil.sort(function(a, b){ return b.totalPoin - a.totalPoin; });
  }

  /**
   * getPrestasiKelas mengembalikan daftar per prestasi (bukan rekap per
   * siswa), sehingga perlu diagregasi dulu di sisi frontend.
   */
  function agregasiPrestasiPerSiswa(daftarPrestasi){
    const peta = {};
    daftarPrestasi.forEach(function(p){
      if (!peta[p.idSiswa]) peta[p.idSiswa] = { namaSiswa: p.namaSiswa, jumlahAkademik: 0, jumlahNonAkademik: 0, total: 0 };
      if (p.jenis === 'Akademik') peta[p.idSiswa].jumlahAkademik++; else peta[p.idSiswa].jumlahNonAkademik++;
      peta[p.idSiswa].total++;
    });
    const hasil = Object.keys(peta).map(function(id){ return peta[id]; });
    return hasil.sort(function(a, b){ return b.total - a.total; });
  }

  function tombolCetak(){
    return '<div class="mb-3 wk-no-print"><button class="btn btn-outline-primary btn-sm" onclick="window.print()">' +
      '<span class="material-icons align-middle" style="font-size:16px;">print</span> Cetak / Simpan PDF</button></div>';
  }

  function renderLaporanRekapKelas(data){
    const baris = data.siswa.map(function(s, i){
      const r = s.rekapAbsensi;
      return '<tr><td>'+(i+1)+'</td><td>'+escapeHtmlJS(s.nis)+'</td><td>'+escapeHtmlJS(s.namaSiswa)+'</td>' +
        '<td>'+r.Hadir+'</td><td>'+r.Alpha+'</td><td>'+s.rataRataNilai+'</td><td>'+s.totalPoinPelanggaran+'</td><td>'+s.jumlahPrestasi+'</td></tr>';
    }).join('');

    document.getElementById('wk-laporan-hasil').innerHTML =
      tombolCetak() +
      '<div class="wk-card"><h5 class="mb-1">Rekap Kelas '+escapeHtmlJS(data.namaKelas)+'</h5>' +
      '<div class="text-muted small mb-3">'+escapeHtmlJS(data.namaSemester)+'</div>' +
      '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>No</th><th>NIS</th><th>Nama</th><th>Hadir</th><th>Alpha</th><th>Rata-rata Nilai</th><th>Poin Pelanggaran</th><th>Prestasi</th></tr></thead>' +
      '<tbody>'+(baris||'<tr><td colspan="8" class="text-center text-muted">Tidak ada data</td></tr>')+'</tbody></table></div></div>';
  }

  function renderLaporanAbsensi(data){
    const baris = data.map(function(d, i){
      const r = d.rekap;
      return '<tr><td>'+(i+1)+'</td><td>'+escapeHtmlJS(d.nis)+'</td><td>'+escapeHtmlJS(d.namaSiswa)+'</td>' +
        '<td>'+r.Hadir+'</td><td>'+r.Izin+'</td><td>'+r.Sakit+'</td><td>'+r.Alpha+'</td><td>'+r.Terlambat+'</td><td>'+d.totalHari+'</td></tr>';
    }).join('');
    document.getElementById('wk-laporan-hasil').innerHTML =
      tombolCetak() +
      '<div class="wk-card"><h5 class="mb-3">Rekap Absensi Semester</h5>' +
      '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>No</th><th>NIS</th><th>Nama</th><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Alpha</th><th>Terlambat</th><th>Total</th></tr></thead>' +
      '<tbody>'+(baris||'<tr><td colspan="9" class="text-center text-muted">Tidak ada data</td></tr>')+'</tbody></table></div></div>';
  }

  function renderLaporanPelanggaran(data){
    const baris = data.map(function(d, i){
      return '<tr><td>'+(i+1)+'</td><td>'+escapeHtmlJS(d.namaSiswa)+'</td><td>'+d.jumlahPelanggaran+'</td><td>'+d.totalPoin+'</td></tr>';
    }).join('');
    document.getElementById('wk-laporan-hasil').innerHTML =
      tombolCetak() +
      '<div class="wk-card"><h5 class="mb-3">Rekap Pelanggaran</h5>' +
      '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>No</th><th>Nama</th><th>Jumlah Pelanggaran</th><th>Total Poin</th></tr></thead>' +
      '<tbody>'+(baris||'<tr><td colspan="4" class="text-center text-muted">Tidak ada data</td></tr>')+'</tbody></table></div></div>';
  }

  function renderLaporanPrestasi(data){
    const baris = data.map(function(d, i){
      return '<tr><td>'+(i+1)+'</td><td>'+escapeHtmlJS(d.namaSiswa)+'</td><td>'+d.jumlahAkademik+'</td><td>'+d.jumlahNonAkademik+'</td><td>'+d.total+'</td></tr>';
    }).join('');
    document.getElementById('wk-laporan-hasil').innerHTML =
      tombolCetak() +
      '<div class="wk-card"><h5 class="mb-3">Rekap Prestasi</h5>' +
      '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>No</th><th>Nama</th><th>Akademik</th><th>Non Akademik</th><th>Total</th></tr></thead>' +
      '<tbody>'+(baris||'<tr><td colspan="5" class="text-center text-muted">Tidak ada data</td></tr>')+'</tbody></table></div></div>';
  }

  // ===================== PENGATURAN =====================
  function renderPengaturan(){
    Promise.all([
      apiCall('getSemuaPengaturan', AppState.token),
      apiCall('getAuditLog', AppState.token, 150),
      apiCall('getRiwayatAkses', AppState.token, 300)
    ]).then(function(hasil){
      const resPeng = hasil[0], resLog = hasil[1], resAkses = hasil[2];
      if (!resPeng.success){ tampilkanErrorView(resPeng.message); return; }
      const p = resPeng.data;
      const log = resLog.success ? resLog.data : [];
      const akses = resAkses.success ? resAkses.data : [];

      const barisLog = log.map(function(l){
        return '<tr><td>'+formatTanggalIndoJS(l.Waktu)+'</td><td>'+escapeHtmlJS(l.Nama_User||'-')+'</td>' +
          '<td>'+escapeHtmlJS(l.Email_User||'-')+'</td><td>'+escapeHtmlJS(l.Aksi)+'</td><td>'+escapeHtmlJS(l.Detail)+'</td></tr>';
      }).join('');

      const pillAksesMap = { LOGIN:'wk-pill-hadir', LOGOUT:'wk-pill-izin', LOGIN_GAGAL:'wk-pill-alpha' };
      const barisAkses = akses.map(function(a){
        const kelasPill = pillAksesMap[a.aksi] || 'wk-pill-izin';
        return '<tr><td>'+formatTanggalIndoJS(a.waktu)+'</td><td>'+escapeHtmlJS(a.nama)+'</td>' +
          '<td>'+escapeHtmlJS(a.email)+'</td><td><span class="wk-pill '+kelasPill+'">'+escapeHtmlJS(a.aksi)+'</span></td>' +
          '<td>'+escapeHtmlJS(a.detail)+'</td></tr>';
      }).join('');

      document.getElementById('wk-content').innerHTML =
        '<div class="wk-fade-in">' +
        '<div class="wk-card mb-3">' +
          '<div class="wk-card-title"><span class="material-icons">school</span>Profil Sekolah</div>' +
          '<div class="row g-2">' +
            '<div class="col-md-6 mb-2"><label class="form-label">Nama Sekolah</label><input type="text" class="form-control" id="wk-peng-nama" value="'+escapeHtmlJS(p.Nama_Sekolah||'')+'"></div>' +
            '<div class="col-md-6 mb-2"><label class="form-label">Kepala Sekolah</label><input type="text" class="form-control" id="wk-peng-kepsek" value="'+escapeHtmlJS(p.Kepala_Sekolah||'')+'"></div>' +
            '<div class="col-md-12 mb-2"><label class="form-label">Alamat Sekolah</label><input type="text" class="form-control" id="wk-peng-alamat" value="'+escapeHtmlJS(p.Alamat_Sekolah||'')+'"></div>' +
            '<div class="col-md-8 mb-2"><label class="form-label">Logo (URL atau unggah file)</label>' +
              '<input type="text" class="form-control mb-1" id="wk-peng-logo-url" value="'+escapeHtmlJS(p.Logo_URL||'')+'" placeholder="URL logo">' +
              '<input type="file" class="form-control" id="wk-peng-logo-file"></div>' +
          '</div>' +
          '<button class="btn btn-primary btn-sm mt-2" onclick="wkSimpanPengaturanSekolah()">Simpan Profil Sekolah</button>' +
        '</div>' +
        '<div class="row g-3 mb-3">' +
          '<div class="col-md-6"><div class="wk-card"><div class="wk-card-title"><span class="material-icons">cloud_download</span>Backup Data</div>' +
            '<p class="text-muted small">Mengunduh seluruh data aplikasi (semua sheet) dalam satu file JSON sebagai cadangan.</p>' +
            '<button class="btn btn-outline-primary btn-sm" onclick="wkBackupData()">Backup Sekarang</button></div></div>' +
          '<div class="col-md-6"><div class="wk-card"><div class="wk-card-title"><span class="material-icons">cloud_upload</span>Restore Data</div>' +
            '<p class="text-muted small">Memulihkan data dari file backup .json. <strong>Tindakan ini akan menimpa data yang ada.</strong></p>' +
            '<input type="file" class="form-control form-control-sm mb-2" id="wk-restore-file" accept=".json">' +
            '<button class="btn btn-outline-danger btn-sm" onclick="wkRestoreData()">Restore Sekarang</button></div></div>' +
        '</div>' +
        '<div class="wk-card wk-table-wrap mb-3">' +
          '<div class="wk-card-title"><span class="material-icons">login</span>Riwayat Akses (Siapa Login ke Sistem)</div>' +
          '<p class="text-muted small mb-2">Mencatat setiap login berhasil, logout, dan percobaan login gagal — lengkap dengan nama, email, dan perangkat/browser yang dipakai. Gunakan kolom pencarian di bawah untuk mencari nama atau email tertentu.</p>' +
          '<div class="table-responsive"><table class="table table-sm" id="wk-dt-akses"><thead><tr><th>Waktu</th><th>Nama</th><th>Email</th><th>Status</th><th>Keterangan</th></tr></thead>' +
          '<tbody>'+(barisAkses||'<tr><td colspan="5" class="text-center text-muted">Belum ada riwayat akses</td></tr>')+'</tbody></table></div>' +
        '</div>' +
        '<div class="wk-card wk-table-wrap"><div class="wk-card-title"><span class="material-icons">history</span>Audit Log (Seluruh Aktivitas)</div>' +
          '<div class="table-responsive"><table class="table table-sm" id="wk-dt-audit"><thead><tr><th>Waktu</th><th>Nama</th><th>Email</th><th>Aksi</th><th>Detail</th></tr></thead>' +
          '<tbody>'+(barisLog||'<tr><td colspan="5" class="text-center text-muted">Belum ada aktivitas</td></tr>')+'</tbody></table></div></div>' +
        '</div>';

      inisialisasiDataTable('#wk-dt-akses');
      inisialisasiDataTable('#wk-dt-audit');
    });
  }

  function wkSimpanPengaturanSekolah(){
    const fileLogo = document.getElementById('wk-peng-logo-file').files[0];

    const lanjut = function(logoUrl){
      const data = {
        namaSekolah: document.getElementById('wk-peng-nama').value,
        kepalaSekolah: document.getElementById('wk-peng-kepsek').value,
        alamatSekolah: document.getElementById('wk-peng-alamat').value,
        logoUrl: logoUrl
      };
      apiCall('simpanPengaturanSekolah', AppState.token, data).then(function(res){
        if (res.success){ toastSukses(res.message); } else { toastGagal(res.message); }
      });
    };

    if (fileLogo){
      const reader = new FileReader();
      reader.onload = function(){
        const base64 = reader.result.split(',')[1];
        apiCall('uploadFile', AppState.token, base64, fileLogo.name, fileLogo.type, 'Logo').then(function(res){
          if (res.success){ lanjut(res.data.url); } else { toastGagal(res.message); }
        });
      };
      reader.readAsDataURL(fileLogo);
    } else {
      lanjut(document.getElementById('wk-peng-logo-url').value);
    }
  }

  function wkBackupData(){
    apiCall('backupData', AppState.token).then(function(res){
      if (!res.success){ toastGagal(res.message); return; }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type:'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'backup-wali-kelas-' + formatTanggalJS(new Date()) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      toastSukses('Backup berhasil diunduh');
    });
  }

  function wkRestoreData(){
    const fileInput = document.getElementById('wk-restore-file');
    const file = fileInput.files[0];
    if (!file){ toastGagal('Pilih file backup terlebih dahulu'); return; }

    Swal.fire({
      icon:'warning', title:'Yakin ingin memulihkan data?',
      text:'Seluruh data yang sesuai pada file backup akan MENIMPA data saat ini. Tindakan ini tidak dapat dibatalkan.',
      showCancelButton:true, confirmButtonText:'Ya, restore', cancelButtonText:'Batal', confirmButtonColor:'#B3392B'
    }).then(function(r){
      if (!r.isConfirmed) return;

      const reader = new FileReader();
      reader.onload = function(){
        try {
          const dataBackup = JSON.parse(reader.result);
          apiCall('restoreData', AppState.token, dataBackup).then(function(res){
            if (res.success){ toastSukses(res.message); } else { toastGagal(res.message); }
          });
        } catch (e){
          toastGagal('File backup tidak valid');
        }
      };
      reader.readAsText(file);
    });
  }
