import os
import sys

remove_str = '【同步更新微信api315全部课程9.9】'

def rename_files(path):
    for root, _, files in os.walk(path):
        for file in files:
            if remove_str in file:
                new_name = file.replace(remove_str, '')
                os.rename(os.path.join(root, file), os.path.join(root, new_name))

if __name__ == '__main__':
    path = sys.argv[1]
    rename_files(path)
