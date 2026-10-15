using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;

namespace UntitledStealthLauncher {
    public class SplashForm : Form {
        private ProgressBar pBar;
        private Label lblStatus;
        private Label lblTitle;
        private Label lblSub;

        public SplashForm() {
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Size = new Size(440, 220);
            this.BackColor = Color.FromArgb(9, 11, 16); // #090b10 obsidian
            this.TopMost = true;

            lblTitle = new Label();
            lblTitle.Text = "UNTITLED STEALTH";
            lblTitle.Font = new Font("Segoe UI", 17, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(248, 250, 252);
            lblTitle.Location = new Point(20, 26);
            lblTitle.Size = new Size(400, 32);
            lblTitle.TextAlign = ContentAlignment.MiddleCenter;
            this.Controls.Add(lblTitle);

            lblSub = new Label();
            lblSub.Text = "Universal VPN & Proxy Desktop Client • v1.0.0";
            lblSub.Font = new Font("Segoe UI", 8, FontStyle.Regular);
            lblSub.ForeColor = Color.FromArgb(0, 240, 255); // neon cyan
            lblSub.Location = new Point(20, 60);
            lblSub.Size = new Size(400, 20);
            lblSub.TextAlign = ContentAlignment.MiddleCenter;
            this.Controls.Add(lblSub);

            lblStatus = new Label();
            lblStatus.Text = "Подготовка к первому запуску...";
            lblStatus.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            lblStatus.ForeColor = Color.FromArgb(148, 163, 184); // slate-400
            lblStatus.Location = new Point(20, 104);
            lblStatus.Size = new Size(400, 24);
            lblStatus.TextAlign = ContentAlignment.MiddleCenter;
            this.Controls.Add(lblStatus);

            pBar = new ProgressBar();
            pBar.Style = ProgressBarStyle.Marquee;
            pBar.MarqueeAnimationSpeed = 25;
            pBar.Location = new Point(45, 142);
            pBar.Size = new Size(350, 10);
            this.Controls.Add(pBar);

            Label lblFooter = new Label();
            lblFooter.Text = "Автономная сборка • sing-box v1.14 + WinTun TUN";
            lblFooter.Font = new Font("Segoe UI", 7, FontStyle.Regular);
            lblFooter.ForeColor = Color.FromArgb(71, 85, 105);
            lblFooter.Location = new Point(20, 180);
            lblFooter.Size = new Size(400, 16);
            lblFooter.TextAlign = ContentAlignment.MiddleCenter;
            this.Controls.Add(lblFooter);
        }

        protected override void OnPaint(PaintEventArgs e) {
            base.OnPaint(e);
            using (Pen borderPen = new Pen(Color.FromArgb(31, 41, 61), 1.5f)) {
                e.Graphics.DrawRectangle(borderPen, 0, 0, this.Width - 1, this.Height - 1);
            }
        }

        public void SetStatus(string text) {
            if (this.InvokeRequired) {
                this.BeginInvoke(new Action<string>(SetStatus), text);
                return;
            }
            lblStatus.Text = text;
        }
    }

    static class Program {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern uint GetModuleFileName(IntPtr hModule, [Out] StringBuilder lpFilename, uint nSize);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern uint GetShortPathName(string lpszLongPath, [Out] StringBuilder lpszShortPath, uint cchBuffer);

        static string GetSafeSelfPath() {
            StringBuilder sb = new StringBuilder(2048);
            GetModuleFileName(IntPtr.Zero, sb, (uint)sb.Capacity);
            string longPath = sb.ToString();

            StringBuilder sbShort = new StringBuilder(2048);
            if (GetShortPathName(longPath, sbShort, (uint)sbShort.Capacity) > 0) {
                return sbShort.ToString();
            }
            return longPath;
        }

        static void KillExistingProcesses() {
            try {
                foreach (var p in Process.GetProcessesByName("UntitledStealth")) {
                    try { p.Kill(); p.WaitForExit(1000); } catch {}
                }
                foreach (var p in Process.GetProcessesByName("sing-box")) {
                    try { p.Kill(); p.WaitForExit(1000); } catch {}
                }
            } catch {}
        }

        [STAThread]
        static void Main(string[] args) {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            KillExistingProcesses();

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string appDir = Path.Combine(localAppData, "Programs", "UntitledStealth");
            string targetExe = Path.Combine(appDir, "UntitledStealth.exe");
            string ffmpegDll = Path.Combine(appDir, "ffmpeg.dll");
            string markerFile = Path.Combine(appDir, ".v101_installed");

            // Если уже распаковано и ffmpeg на месте — запускаем моментально
            if (File.Exists(targetExe) && File.Exists(markerFile) && File.Exists(ffmpegDll)) {
                LaunchApp(targetExe, appDir, args);
                return;
            }

            SplashForm splash = new SplashForm();
            splash.Show();
            Application.DoEvents();

            Thread worker = new Thread(() => {
                try {
                    splash.SetStatus("Распаковка компонентов Untitled Stealth...");
                    KillExistingProcesses();

                    if (!Directory.Exists(appDir)) {
                        Directory.CreateDirectory(appDir);
                    }

                    string selfPath = GetSafeSelfPath();
                    using (FileStream fs = new FileStream(selfPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
                        if (fs.Length < 16) {
                            throw new Exception("Некорректный размер файла сборки.");
                        }

                        fs.Seek(-8, SeekOrigin.End);
                        byte[] lenBytes = new byte[8];
                        fs.Read(lenBytes, 0, 8);
                        long payloadLen = BitConverter.ToInt64(lenBytes, 0);

                        if (payloadLen <= 0 || payloadLen > fs.Length) {
                            throw new Exception("Ресурсы приложения не найдены внутри исполняемого файла.");
                        }

                        long payloadStart = fs.Length - 8 - payloadLen;
                        fs.Seek(payloadStart, SeekOrigin.Begin);

                        string tempZip = Path.Combine(Path.GetTempPath(), "us_extract_" + Guid.NewGuid().ToString("N") + ".zip");
                        try {
                            using (FileStream zipFs = new FileStream(tempZip, FileMode.Create, FileAccess.Write, FileShare.None)) {
                                byte[] buffer = new byte[1024 * 1024]; // 1MB buffer
                                long remaining = payloadLen;
                                while (remaining > 0) {
                                    int toRead = (int)Math.Min(buffer.Length, remaining);
                                    int read = fs.Read(buffer, 0, toRead);
                                    if (read <= 0) break;
                                    zipFs.Write(buffer, 0, read);
                                    remaining -= read;
                                }
                            }

                            splash.SetStatus("Установка сетевого ядра и библиотек...");
                            using (ZipArchive archive = ZipFile.OpenRead(tempZip)) {
                                foreach (ZipArchiveEntry entry in archive.Entries) {
                                    if (string.IsNullOrEmpty(entry.Name)) {
                                        string dirPath = Path.Combine(appDir, entry.FullName);
                                        if (!Directory.Exists(dirPath)) Directory.CreateDirectory(dirPath);
                                        continue;
                                    }
                                    string destPath = Path.Combine(appDir, entry.FullName);
                                    string destDir = Path.GetDirectoryName(destPath);
                                    if (!Directory.Exists(destDir)) Directory.CreateDirectory(destDir);
                                    entry.ExtractToFile(destPath, true);
                                }
                            }

                            // Создаем ярлык на рабочем столе с правами Администратора
                            CreateDesktopShortcut(targetExe, appDir);

                            File.WriteAllText(markerFile, DateTime.UtcNow.ToString("o"));
                        } finally {
                            if (File.Exists(tempZip)) {
                                try { File.Delete(tempZip); } catch {}
                            }
                        }
                    }

                    splash.SetStatus("Запуск Untitled Stealth...");
                    Thread.Sleep(400);

                    splash.Invoke(new Action(() => {
                        splash.Hide();
                        LaunchApp(targetExe, appDir, args);
                        Application.Exit();
                    }));
                } catch (Exception ex) {
                    MessageBox.Show("Ошибка при распаковке Untitled Stealth:\n" + ex.ToString(), "Untitled Stealth Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    Application.Exit();
                }
            });

            worker.IsBackground = true;
            worker.Start();

            Application.Run(splash);
        }

        static void CreateDesktopShortcut(string targetExe, string workDir) {
            try {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string lnkPath = Path.Combine(desktop, "Untitled Stealth.lnk");
                string iconPath = Path.Combine(workDir, "resources", "app", "icons", "app.ico");
                if (!File.Exists(iconPath)) {
                    iconPath = Path.Combine(workDir, "icons", "app.ico");
                }

                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null) {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(lnkPath);
                    shortcut.TargetPath = targetExe;
                    shortcut.Arguments = "";
                    shortcut.WorkingDirectory = workDir;
                    shortcut.Description = "Untitled Stealth - Ультра-быстрый VPN клиент";
                    if (File.Exists(iconPath)) {
                        shortcut.IconLocation = iconPath + ", 0";
                    }
                    shortcut.Save();

                    // Флаг RunAsAdmin (байт 21: 0x20)
                    byte[] bytes = File.ReadAllBytes(lnkPath);
                    if (bytes.Length > 21) {
                        bytes[21] = (byte)(bytes[21] | 0x20);
                        File.WriteAllBytes(lnkPath, bytes);
                    }
                }
            } catch {}
        }

        static void LaunchApp(string exePath, string workDir, string[] args) {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = exePath;
            psi.WorkingDirectory = workDir;
            if (args != null && args.Length > 0) {
                psi.Arguments = string.Join(" ", args);
            }
            psi.UseShellExecute = true;
            psi.Verb = "runas"; // Запуск от имени Администратора для TUN
            try {
                Process.Start(psi);
            } catch {
                // Если пользователь нажал "Нет" в UAC, пробуем без повышенных прав
                psi.Verb = "";
                Process.Start(psi);
            }
        }
    }
}
