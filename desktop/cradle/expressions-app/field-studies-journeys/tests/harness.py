"""Local-content browser harness. No network, URL policy changes or remote assets required."""
from pathlib import Path
import os, shutil, subprocess, time, contextlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
# Captures and reports go where the run says, else beside the cradle's other
# browser evidence (ignored by git, retained by CI); a run never rewrites the tree.
EVIDENCE=Path(os.environ.get('FIELD_EVIDENCE_DIR') or ROOT.parents[1]/'tests/artifacts/field-studies-journeys')
EVIDENCE.mkdir(parents=True,exist_ok=True)
# Xvfb/software-WebGL setup retained from the supplied MIT-licensed testing harness.

# The candidate serves the frame from a secure origin, and the frame uses
# secure-context APIs (crypto.randomUUID). Content set on about:blank has no
# secure context, so every page first opens an empty document this context
# fulfils itself at an https origin, and set_content writes into that page.
# Nothing reaches a network.
SECURE_ORIGIN='https://expressions.test/'
_secured=[]
def secure_page(context):
    if not any(known is context for known in _secured):
        context.route(SECURE_ORIGIN+'**',lambda route:route.fulfill(status=200,content_type='text/html',body='<!doctype html><html><head></head><body></body></html>'))
        _secured.append(context)
    page=context.new_page();page.goto(SECURE_ORIGIN)
    return page

def fresh_document(page):
    """A new document with a new global, as a reload gives (set_content alone keeps the window and its globals)."""
    page.goto(SECURE_ORIGIN)

def first_difference(a,b,path='$'):
    """The first path at which two JSON values differ, or None when equal."""
    if type(a)!=type(b):return f'{path}: {a!r} != {b!r}'
    if isinstance(a,dict):
        for key in sorted(set(a)|set(b)):
            if key not in a or key not in b:return f'{path}.{key}: on one side only'
            found=first_difference(a[key],b[key],f'{path}.{key}')
            if found:return found
        return None
    if isinstance(a,list):
        if len(a)!=len(b):return f'{path}: {len(a)} items != {len(b)}'
        for index,(x,y) in enumerate(zip(a,b)):
            found=first_difference(x,y,f'{path}[{index}]')
            if found:return found
        return None
    return None if a==b else f'{path}: {a!r} != {b!r}'

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
            page=secure_page(context)
            if reduced_motion:page.emulate_media(reduced_motion=reduced_motion)
            yield browser,context,page
            browser.close()
    finally:
        if display_process: display_process.terminate();display_process.wait(timeout=5)
        if original_display is None:os.environ.pop('DISPLAY',None)
        else:os.environ['DISPLAY']=original_display

