import os
import sys
from zipfile import ZipFile
from xml.dom.minidom import parse

# The current working directory has to be where make.py is.
# os.chdir(os.path.split(sys.argv[0])[0])

install = parse(os.path.join("birdquizz", "install.rdf"))
element = install.getElementsByTagName("em:version")[0]
version = element.firstChild.data
xpiName = "birdquizz-" + version + ".xpi"
xpi = ZipFile(xpiName, "w")
os.chdir("birdquizz")
for root, dirs, files in os.walk("."):
    dirs.remove(".svn")
    for name in files:
        path = os.path.join(root, name)
        xpi.write(path, path, 8)
xpi.close()
os.chdir("..")
if os.path.exists(xpiName):
    print(xpiName + " successfully written.")
else:
    sys.exit(xpiName + " could not be written.")
