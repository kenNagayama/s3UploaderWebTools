import re

with open("backend/backend_stack.py", "r") as f:
    content = f.read()

# replace type="int" and type="double" with type="string"
content = content.replace('type="int"', 'type="string"')
content = content.replace('type="double"', 'type="string"')

with open("backend/backend_stack.py", "w") as f:
    f.write(content)
