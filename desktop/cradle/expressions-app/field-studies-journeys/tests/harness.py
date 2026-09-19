"""Local-content browser harness. No network, URL policy changes or remote assets required."""
from pathlib import Path
import os, shutil, subprocess, time, contextlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
# Xvfb/software-WebGL setup retained from the supplied MIT-licensed testing harness.

@contextlib.contextmanager
def browser_session(viewport=None, reduced_motion=None):
    display_process=None
    original_display=os.environ.get('DISPLAY')
    if os.name=='posix' and shutil.which('Xvfb'):
        current=(original_display or ':0').split(':')[-1].split('.')[0]
        if not Path('/tmp/.X11-unix/X'+current).exists():
            number=170+os.getpid()%300
            display_process=subprocess.Popen(['Xvfb',f':{number}','-screen','0','1920x1200x24','-nolisten','tcp'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            os.environ['DISPLAY']=f':{number}'
            for _ in range(30):
                if Path(f'/tmp/.X11-unix/X{number}').exists(): break
                time.sleep(.1)
    try:
        with sync_playwright() as p:
            args=['--disable-dev-shm-usage']
            if hasattr(os,'geteuid') and os.geteuid()==0: args+=['--no-sandbox']
            if os.environ.get('FIELD_HARDWARE')!='1': args+=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
            executable=os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or shutil.which('google-chrome')
            launch={'headless':True,'args':args}
            if executable:launch['executable_path']=executable
            browser=p.chromium.launch(**launch)
            context=browser.new_context(viewport=viewport or {'width':900,'height':700},device_scale_factor=1,accept_downloads=True)
            page=context.new_page()
            if reduced_motion:page.emulate_media(reduced_motion=reduced_motion)
            yield browser,context,page
            browser.close()
    finally:
        if display_process: display_process.terminate();display_process.wait(timeout=5)
        if original_display is None:os.environ.pop('DISPLAY',None)
        else:os.environ['DISPLAY']=original_display

