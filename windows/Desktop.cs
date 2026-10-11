using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Program
{
    internal const string MutexName = "Local\\DSE.Desktop";
    internal static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    internal static readonly string Data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DiscordSaveEmoji");
    internal static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    internal static readonly string[] Languages = { "zh-CN", "zh-TW", "en" };
    internal static string Quote(string value) { return "\"" + value + "\""; }
    internal static Dictionary<string, string> Pack(string language)
    {
        return Json.Deserialize<Dictionary<string, string>>(File.ReadAllText(Path.Combine(Root, "locales", language + ".json")));
    }

    [STAThread]
    static void Main(string[] args)
    {
        if (Array.IndexOf(args, "--self-test") >= 0) { SelfTest(); return; }
        bool first;
        using (var mutex = new Mutex(true, MutexName, out first))
        using (var show = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\DSE.Show"))
        {
            if (!first) { show.Set(); return; }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            try { Application.Run(new MainWindow(show, Array.IndexOf(args, "--background") >= 0)); }
            catch { MessageBox.Show("DSE cannot load its files or settings. Check the installation and folder permissions.", "DSE"); }
        }
    }

    static void SelfTest()
    {
        var english = Pack("en");
        foreach (string lang in Languages)
        {
            var pack = Pack(lang);
            foreach (string key in english.Keys)
                if (!pack.ContainsKey(key) || String.IsNullOrWhiteSpace(pack[key])) throw new Exception("Missing translation: " + key);
            if (!File.Exists(Path.Combine(Root, "docs", "help-" + lang + ".html"))) throw new Exception("Missing help");
        }
        if (!File.Exists(Path.Combine(Root, "runtime", "node.exe"))) throw new Exception("Missing runtime");
        if (!File.Exists(Path.Combine(Root, "bot.js"))) throw new Exception("Missing bot");
        if (Quote("C:\\a b\\DSE.exe") != "\"C:\\a b\\DSE.exe\"") throw new Exception("Invalid quoting");
        File.WriteAllText(Path.Combine(Path.GetTempPath(), "dse-desktop-self-test.txt"), "PASS");
    }
}

internal sealed class MainWindow : Form
{
    const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    readonly EventWaitHandle showEvent;
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer { Interval = 1000 };
    readonly NotifyIcon tray = new NotifyIcon();
    readonly Label status = new Label(), hint = new Label(), notice = new Label(), languageLabel = new Label();
    readonly Button toggle = new Button(), env = new Button(), help = new Button(), save = new Button(), user = new Button(), guild = new Button();
    readonly CheckBox startup = new CheckBox();
    readonly ComboBox languageBox = new ComboBox();
    Dictionary<string, string> pack;
    string language, state = "stopped", appId;
    Process service;
    DateTime lastStatus;
    bool quitting, stopping;
    readonly string settingsPath = Path.Combine(Program.Data, "settings.json");
    readonly string envPath = Path.Combine(Program.Data, ".env");
    string T(string key) { return pack[key]; }

    internal MainWindow(EventWaitHandle show, bool background)
    {
        showEvent = show;
        Directory.CreateDirectory(Program.Data);
        if (!File.Exists(envPath)) File.Copy(Path.Combine(Program.Root, ".env.example"), envPath);
        language = System.Globalization.CultureInfo.CurrentUICulture.Name;
        if (Array.IndexOf(Program.Languages, language) < 0) language = language.StartsWith("zh") ? "zh-CN" : "en";
        if (File.Exists(settingsPath))
        {
            var settings = Program.Json.Deserialize<Dictionary<string, string>>(File.ReadAllText(settingsPath));
            if (settings != null && settings.ContainsKey("language") && Array.IndexOf(Program.Languages, settings["language"]) >= 0) language = settings["language"];
        }
        pack = Program.Pack(language);
        Text = "Discord Save Emoji";
        Icon = new Icon(Path.Combine(Program.Root, "assets", "icon.ico"));
        Font = new Font("Microsoft YaHei UI", 10F);
        AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(540, 374);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(248, 249, 253);
        var title = new Label { Text = "Discord Save Emoji", Font = new Font(Font.FontFamily, 17, FontStyle.Bold), AutoSize = true, Location = new Point(24, 22) };
        Controls.Add(title);
        status.SetBounds(24, 66, 492, 30); status.Font = new Font(Font, FontStyle.Bold);
        toggle.SetBounds(24, 110, 148, 38); env.SetBounds(184, 110, 200, 38); help.SetBounds(396, 110, 120, 38);
        user.SetBounds(24, 163, 240, 36); guild.SetBounds(276, 163, 240, 36);
        languageLabel.SetBounds(24, 220, 150, 26);
        languageBox.SetBounds(184, 217, 200, 30); languageBox.DropDownStyle = ComboBoxStyle.DropDownList;
        languageBox.Items.AddRange(new object[] { "简体中文", "繁體中文", "English" });
        languageBox.SelectedIndex = Array.IndexOf(Program.Languages, language);
        startup.SetBounds(24, 258, 355, 28);
        using (var key = Registry.CurrentUser.OpenSubKey(RunKey)) startup.Checked = key != null && key.GetValue("DiscordSaveEmoji") != null;
        save.SetBounds(396, 252, 120, 36);
        notice.SetBounds(24, 292, 492, 24); notice.ForeColor = Color.FromArgb(42, 115, 84);
        hint.SetBounds(24, 323, 492, 42); hint.Font = new Font(Font.FontFamily, 9F); hint.ForeColor = Color.DimGray;
        Controls.AddRange(new Control[] { status, toggle, env, help, user, guild, languageLabel, languageBox, startup, save, notice, hint });
        toggle.Click += delegate { if (service == null) StartService(); else StopService(); };
        env.Click += delegate { Safe(EditEnvironment); };
        help.Click += delegate { Safe(delegate { Process.Start(new ProcessStartInfo(Path.Combine(Program.Root, "docs", "help-" + language + ".html")) { UseShellExecute = true }); }); };
        user.Click += delegate { OpenInstall(false); }; guild.Click += delegate { OpenInstall(true); };
        languageBox.SelectedIndexChanged += delegate {
            language = Program.Languages[languageBox.SelectedIndex]; pack = Program.Pack(language); notice.Text = ""; Render();
        };
        save.Click += delegate { Safe(SaveSettings); };
        tray.Icon = Icon; tray.Text = Text; tray.Visible = true;
        tray.DoubleClick += delegate { ShowWindow(); };
        FormClosing += delegate(object sender, FormClosingEventArgs e) {
            if (!quitting && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; Hide(); }
        };
        FormClosed += delegate { timer.Stop(); StopService(); tray.Dispose(); };
        timer.Tick += delegate {
            if (showEvent.WaitOne(0)) ShowWindow();
            if (service != null && service.HasExited) { service.Dispose(); service = null; state = stopping ? "stopped" : "failed"; stopping = false; Render(); }
            else if (service != null && state == "ready" && (DateTime.UtcNow - lastStatus).TotalSeconds > 12) { state = "reconnecting"; Render(); }
        };
        timer.Start();
        Shown += delegate { if (background) Hide(); StartService(); };
        Render();
    }

    void Safe(Action action)
    {
        try { action(); } catch { MessageBox.Show(this, T("fileError"), "DSE", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }
    void ShowWindow() { Show(); WindowState = FormWindowState.Normal; Activate(); }
    void EditEnvironment()
    {
        using (var editor = new Form { Text = T("env"), Font = Font, ClientSize = new Size(650, 350), StartPosition = FormStartPosition.CenterParent, MinimizeBox = false, MaximizeBox = false })
        {
            var text = new TextBox { Multiline = true, AcceptsReturn = true, AcceptsTab = true, ScrollBars = ScrollBars.Both, WordWrap = false,
                Dock = DockStyle.Fill, Font = new Font(Font.FontFamily, 10), Text = File.ReadAllText(envPath).Replace("\r\n", "\n").Replace("\n", "\r\n") };
            var button = new Button { Text = T("saveSettings"), Dock = DockStyle.Bottom, Height = 40 };
            button.Click += delegate { Safe(delegate {
                File.WriteAllText(envPath + ".tmp", text.Text, new UTF8Encoding(false));
                File.Replace(envPath + ".tmp", envPath, null);
                editor.Close();
                notice.Text = T("saved");
            }); };
            editor.Controls.Add(text); editor.Controls.Add(button);
            editor.ShowDialog(this);
        }
    }
    void Render()
    {
        status.Text = T(state); status.ForeColor = state == "ready" ? Color.FromArgb(31, 132, 87) : Color.FromArgb(84, 88, 114);
        toggle.Text = T(service == null ? "start" : "stop");
        env.Text = T("env"); help.Text = T("help"); save.Text = T("saveSettings"); startup.Text = T("startup");
        languageLabel.Text = T("language"); hint.Text = T("hint"); user.Text = T("userInstall"); guild.Text = T("guildInstall");
        user.Enabled = guild.Enabled = appId != null;
        var old = tray.ContextMenuStrip;
        tray.ContextMenuStrip = new ContextMenuStrip();
        tray.ContextMenuStrip.Items.Add(T("show"), null, delegate { ShowWindow(); });
        tray.ContextMenuStrip.Items.Add(T("exit"), null, delegate { quitting = true; Close(); });
        if (old != null) old.Dispose();
    }
    void SaveSettings()
    {
        // Write preferences atomically before reporting success.
        string temp = settingsPath + ".tmp";
        File.WriteAllText(temp, Program.Json.Serialize(new Dictionary<string, string> { { "language", language } }), new UTF8Encoding(false));
        if (File.Exists(settingsPath)) File.Replace(temp, settingsPath, null); else File.Move(temp, settingsPath);
        using (var key = Registry.CurrentUser.CreateSubKey(RunKey))
        {
            if (startup.Checked) key.SetValue("DiscordSaveEmoji", Program.Quote(Application.ExecutablePath) + " --background");
            else key.DeleteValue("DiscordSaveEmoji", false);
        }
        notice.Text = T("saved");
    }
    void OpenInstall(bool target)
    {
        if (appId == null) return;
        string url = "https://discord.com/oauth2/authorize?client_id=" + appId + (target
            ? "&scope=bot%20applications.commands&permissions=8796093022208&integration_type=0"
            : "&scope=applications.commands&integration_type=1");
        Safe(delegate { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); });
    }
    void StartService()
    {
        if (service != null) return;
        appId = null; stopping = false; state = "starting";
        try
        {
            var info = new ProcessStartInfo(Path.Combine(Program.Root, "runtime", "node.exe"), "--env-file=" + Program.Quote(envPath) + " " + Program.Quote(Path.Combine(Program.Root, "bot.js"))) {
                WorkingDirectory = Program.Root, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true,
                StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
            };
            // .env is authoritative; inherited variables must not silently override the edited file.
            foreach (string key in new[] { "DISCORD_TOKEN", "TARGET_GUILD_ID", "OWNER_ID", "NODE_OPTIONS" }) info.EnvironmentVariables.Remove(key);
            info.EnvironmentVariables["DSE_DATA_DIR"] = Program.Data;
            info.EnvironmentVariables["DSE_DESKTOP"] = "1";
            info.EnvironmentVariables["DSE_LANGUAGE"] = language;
            service = new Process { StartInfo = info };
            var current = service;
            service.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) {
                if (e.Data == null || !e.Data.StartsWith("{")) return;
                try {
                    var data = Program.Json.Deserialize<Dictionary<string, string>>(e.Data);
                    string next;
                    if (!data.TryGetValue("state", out next) || Array.IndexOf(new[] { "ready", "reconnecting", "failed" }, next) < 0) return;
                    BeginInvoke((Action)delegate {
                        if (service != current || stopping) return;
                        state = next; lastStatus = DateTime.UtcNow;
                        string id;
                        if (data.TryGetValue("appId", out id) && id != null && System.Text.RegularExpressions.Regex.IsMatch(id, @"^\d{17,20}$")) appId = id;
                        Render();
                    });
                } catch { /* Ignore non-status stdout; never display raw API errors or tokens. */ }
            };
            service.ErrorDataReceived += delegate { }; // Drain stderr without persisting credentials from unexpected errors.
            service.Start(); service.BeginOutputReadLine(); service.BeginErrorReadLine(); lastStatus = DateTime.UtcNow;
        }
        catch { if (service != null) service.Dispose(); service = null; state = "failed"; }
        Render();
    }
    void StopService()
    {
        if (service == null) return;
        stopping = true;
        try {
            if (!service.HasExited) {
                service.StandardInput.WriteLine("stop"); service.StandardInput.Flush();
                if (!service.WaitForExit(3000)) service.Kill();
            }
        } catch (InvalidOperationException) { }
        catch (IOException) { if (!service.HasExited) service.Kill(); }
        finally { service.Dispose(); service = null; state = "stopped"; stopping = false; if (!quitting) Render(); }
    }
}
