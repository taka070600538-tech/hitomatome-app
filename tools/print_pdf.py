import sys
import fitz
import win32print
import win32gui
import win32ui
from PIL import Image, ImageWin

DMORIENT_PORTRAIT = 1
DM_ORIENTATION = 0x00000001

pdf_path = sys.argv[1]
printer_name = sys.argv[2] if len(sys.argv) > 2 else win32print.GetDefaultPrinter()
print(f"Printer: {printer_name}")

hprinter = win32print.OpenPrinter(printer_name)
props = win32print.GetPrinter(hprinter, 2)
devmode = props["pDevMode"]
devmode.Orientation = DMORIENT_PORTRAIT
devmode.Fields |= DM_ORIENTATION
win32print.ClosePrinter(hprinter)

doc = fitz.open(pdf_path)

hdc_handle = win32gui.CreateDC("WINSPOOL", printer_name, devmode)
hdc = win32ui.CreateDCFromHandle(hdc_handle)

printable_w = hdc.GetDeviceCaps(8)   # HORZRES
printable_h = hdc.GetDeviceCaps(10)  # VERTRES
print(f"printable area: {printable_w} x {printable_h}")

hdc.StartDoc(pdf_path)

for i, page in enumerate(doc):
    zoom = 300 / 72
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    ratio = min(printable_w / img.width, printable_h / img.height)
    out_w, out_h = int(img.width * ratio), int(img.height * ratio)
    x_off = (printable_w - out_w) // 2
    y_off = (printable_h - out_h) // 2

    hdc.StartPage()
    dib = ImageWin.Dib(img)
    dib.draw(hdc.GetHandleOutput(), (x_off, y_off, x_off + out_w, y_off + out_h))
    hdc.EndPage()
    print(f"page {i+1} sent")

hdc.EndDoc()
hdc.DeleteDC()
print("done")
