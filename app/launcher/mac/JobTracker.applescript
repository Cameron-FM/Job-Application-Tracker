-- Source for "Job Tracker.app" (macOS). Compiled to a proper AppleScript applet
-- with `osacompile` (see launcher/mac/build-app.sh) — an applet has a real,
-- macOS-trusted executable, unlike a shell-script-as-CFBundleExecutable, which
-- modern macOS (26+) refuses to launch via double-click.
--
-- All real launcher logic lives in app/launch.command (all program files live
-- inside app/; the project root holds only the launchers + data). This applet
-- resolves the project directory (the folder containing the .app) and hands off.
-- `path to me` is the .app bundle; its parent dir is the project root.
on run
	set appPath to POSIX path of (path to me)
	set projectRoot to (do shell script "dirname " & quoted form of appPath)
	-- Fire launch.command off DETACHED. Critical: `do shell script` waits for the
	-- command's stdout to reach EOF, and launch.command starts a long-lived server,
	-- so without `nohup … > /dev/null 2>&1 &` this hangs forever (and the applet
	-- never finishes). nohup + backgrounding lets the applet return immediately
	-- while launch.command runs on to install/start the server and open the browser.
	do shell script "nohup " & quoted form of (projectRoot & "/app/launch.command") & " > /dev/null 2>&1 &"
end run
