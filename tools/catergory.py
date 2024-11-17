import os
import glob
import yaml
import shutil


# POSTS_PATH = '../_posts'

CATEGORIES_PATH = '../category'
CATEGORY_LAYOUT = 'category'

POSTS_PATH = '../_posts'

def load_category_mapping(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        return yaml.safe_load(file)

def get_front_matter(path):
    end = False
    front_matter = ""
    with open(path, 'r') as f:
        for line in f.readlines():
            if line.strip() == '---':
                if end:
                    break
                else:
                    end = True
                    continue
            front_matter += line
    print(front_matter)
    return front_matter


def get_categories():
    all_categories = []

    for file in glob.glob(os.path.join(POSTS_PATH, '*.md')):
        meta = yaml.load(get_front_matter(file), Loader=yaml.FullLoader)
        if meta is None:
            print(f"[Error] File {file} has no valid YAML front matter.")
            continue

        category = meta.get('category')
        categories = meta.get('categories')

        if category:
            if isinstance(category, list):
                print(f"[Error] File {file} 'category' type can not be LIST!")
                continue
            if category not in all_categories:
                all_categories.append(category)
        elif categories:
            if not isinstance(categories, list):
                print(f"[Error] File {file} 'categories' type can not be STR!")
                continue
            for ctg in categories:
                if ctg not in all_categories:
                    all_categories.append(ctg)
        else:
            print(f"[Error] File {file} has no 'category' or 'categories' in front matter.")

    return all_categories


def generate_category_pages():
    categories = get_categories()
    if os.path.exists(CATEGORIES_PATH):
        shutil.rmtree(CATEGORIES_PATH)

    os.makedirs(CATEGORIES_PATH)

    category_mapping = load_category_mapping('../_data/categories.yml')
    category_dict = {item['name']: item['slug'] for item in category_mapping}
    for category in categories:
        english_name = category_dict.get(category, category)
        new_page = os.path.join(CATEGORIES_PATH, english_name + '.html')
        with open(new_page, 'w+') as html:
            html.write("---\n")
            html.write("layout: {}\n".format(CATEGORY_LAYOUT))
            html.write("title: {}\n".format(category.title()))
            html.write("category: {}\n".format(category))
            html.write("---")
            print("[INFO] Created page: " + new_page)
    print("[INFO] Succeed! {} category-pages created.\n"
          .format(len(categories)))


def main():
    generate_category_pages()

main()
