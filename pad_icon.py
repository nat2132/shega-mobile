from PIL import Image

try:
    img = Image.open('src/assets/images/Vector.png')
    img = img.convert("RGBA")

    # Resize keeping aspect ratio to fit in 768x768 (a bit of padding in 1024x1024)
    # But wait, making it 512x512 might be safer if that's what Expo uses sometimes, but 1024x1024 is the maximum recommended. Let's stick with 1024.
    max_size = (768, 768)
    img.thumbnail(max_size, Image.Resampling.LANCZOS)

    new_img = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))

    paste_pos = ((1024 - img.width) // 2, (1024 - img.height) // 2)
    new_img.paste(img, paste_pos, mask=img)

    new_img.save('src/assets/images/icon-square.png')
    print("Successfully created square icon.")
except Exception as e:
    print(f"Error: {e}")
