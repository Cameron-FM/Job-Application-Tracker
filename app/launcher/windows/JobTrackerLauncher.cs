// The source for the "Job Tracker (Windows).exe" wrapper around launch.bat.
// Deliberately tiny: all real launcher logic stays in launch.bat (kept
// separate from application code, per the launcher brief). This just finds
// its own folder and hands off to launch.bat (tucked away at
// app\launcher\windows\launch.bat, not the project root), hidden window,
// then exits immediately — launch.bat does its own error reporting (native
// message boxes via mshta) if anything goes wrong, so this wrapper doesn't
// need to wait around or handle failures itself.
//
// Compiled by make_exe.bat using the C# compiler that ships with every
// Windows install — see launcher/windows/make_exe.bat. This .exe is expected
// to live at the project ROOT (that's how it locates app\launcher\windows\
// below it) — if you move it, update the relative path here and recompile.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

class JobTrackerLauncher
{
    static void Main()
    {
        string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        // Chained 2-arg Path.Combine calls (not the 5-arg overload) so this compiles
        // against .NET Framework 3.5's csc.exe too, not just 4.0+ — make_exe.bat
        // falls back to 3.5 if a 4.0 compiler isn't found on the machine.
        string batPath = Path.Combine(Path.Combine(Path.Combine(Path.Combine(
            exeDir, "app"), "launcher"), "windows"), "launch.bat");

        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/c \"" + batPath + "\"",
            WorkingDirectory = exeDir,
            UseShellExecute = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            CreateNoWindow = true,
        };
        Process.Start(psi);
    }
}
