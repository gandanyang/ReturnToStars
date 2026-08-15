# -*- coding: utf-8 -*-
"""
夏雅 sprite 程序绘制（原始方案，对齐 NPC 程序管线）
输出：public/assets/sprites/npc_xiya.png（32x32 idle down）
特征（夏雅人物圣经 v1.3）：橙金短发 / 工装上衣 / 旧工具包（标志性资产，斜挎腰侧）
风格对齐 gen_sprite_assets（C 调色板 + draw_face_down_32 + add_outline）
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
from PIL import Image
from gen_sprite_assets import C, blank_sprite, px, rect, hline, vline, box_outline, add_outline, draw_face_down_32


# —— 夏雅专属调色板（橙金短发 + 工装 + 工具包） ——
class X:
    HAIR = (222, 156, 74, 255)          # 橙金短发主色
    HAIR_MID = (240, 184, 108, 255)     # 发丝亮
    HAIR_S = (186, 124, 54, 255)        # 发影
    SHIRT = (92, 128, 158, 255)         # 工装上衣（藏青蓝）
    SHIRT_MID = (112, 146, 174, 255)
    SHIRT_S = (66, 96, 124, 255)
    SHIRT_HL = (136, 168, 194, 255)     # 肩高光
    PANTS = (70, 84, 104, 255)          # 工装裤（深蓝灰）
    PANTS_MID = (58, 70, 90, 255)
    PANTS_S = (46, 56, 74, 255)
    BAG = (150, 100, 58, 255)           # 旧工具包（棕）
    BAG_MID = (172, 122, 76, 255)
    BAG_S = (116, 76, 44, 255)
    BAG_FLAP = (134, 88, 50, 255)       # 包盖
    BUCKLE = (222, 178, 96, 255)        # 包扣（旧铜）
    SHOES = (88, 66, 48, 255)           # 工装鞋（深棕）
    SHOES_S = (66, 48, 34, 255)
    TOOL = (140, 140, 150, 255)         # 扳手金属
    TOOL_S = (108, 108, 118, 255)
    TOOL_HANDLE = (150, 106, 62, 255)   # 扳手柄（木）
    STRAP = (120, 80, 46, 255)          # 肩带


def npc_xiya_frame_32() -> Image.Image:
    img = blank_sprite()

    # —— 鞋（深棕工装鞋，y 30-31） ——
    rect(img, 10, 30, 14, 31, X.SHOES)
    rect(img, 17, 30, 21, 31, X.SHOES)
    hline(img, 10, 14, 31, X.SHOES_S)
    hline(img, 17, 21, 31, X.SHOES_S)
    hline(img, 10, 14, 30, X.SHOES_S)
    hline(img, 17, 21, 30, X.SHOES_S)

    # —— 腿（工装裤，y 23-29） ——
    rect(img, 10, 23, 14, 29, X.PANTS)
    vline(img, 10, 23, 29, X.PANTS_S)
    vline(img, 14, 23, 29, X.PANTS_MID)
    rect(img, 17, 23, 21, 29, X.PANTS)
    vline(img, 17, 23, 29, X.PANTS_MID)
    vline(img, 21, 23, 29, X.PANTS_S)
    # 裤腿中缝
    for y in range(24, 29, 2):
        px(img, 12, y, X.PANTS_MID)
        px(img, 19, y, X.PANTS_MID)

    # —— 身体（工装上衣，y 11-22） ——
    rect(img, 8, 11, 23, 22, X.SHIRT)
    vline(img, 8, 11, 22, X.SHIRT_S)
    vline(img, 23, 11, 22, X.SHIRT_S)
    hline(img, 8, 23, 22, X.SHIRT_S)
    # 上衣竖向（拉链/前襟）
    for y in range(12, 21):
        px(img, 15, y, X.SHIRT_S)
        px(img, 16, y, X.SHIRT_S)
    # 左肩高光
    rect(img, 8, 11, 11, 13, X.SHIRT_HL)
    # 上衣下摆
    hline(img, 8, 23, 21, X.SHIRT_MID)

    # —— 旧工具包（斜挎腰侧右侧，标志性资产） ——
    # 肩带（从左上斜到右包）
    for i in range(0, 8):
        px(img, 10 + i, 13 + i, X.STRAP)
    # 包身（右侧 x21-26, y15-22）
    rect(img, 21, 15, 26, 22, X.BAG)
    vline(img, 21, 15, 22, X.BAG_S)
    vline(img, 26, 15, 22, X.BAG_S)
    # 包盖（上部 x20-27）
    rect(img, 20, 14, 27, 16, X.BAG_FLAP)
    hline(img, 20, 27, 16, X.BAG_S)
    # 包扣（旧铜）
    px(img, 23, 16, X.BUCKLE)
    px(img, 24, 16, X.BUCKLE)
    # 包中部织带
    hline(img, 21, 26, 19, X.BAG_FLAP)
    # 包高光
    px(img, 22, 15, X.BAG_MID)
    px(img, 22, 17, X.BAG_MID)

    # —— 手臂（工装袖 + 手，左臂自然下垂） ——
    # 左臂（x 6-7）
    rect(img, 6, 13, 7, 20, X.SHIRT)
    vline(img, 6, 13, 20, X.SHIRT_S)
    hline(img, 6, 7, 20, X.SHIRT_MID)
    rect(img, 6, 21, 7, 22, C.SKIN)  # 手
    # 右臂（x 24-25，稍抬（拿扳手感））
    rect(img, 24, 12, 25, 19, X.SHIRT)
    vline(img, 25, 12, 19, X.SHIRT_S)
    hline(img, 24, 25, 19, X.SHIRT_MID)
    rect(img, 24, 20, 25, 21, C.SKIN)  # 手
    # 手里的小扳手（朝右下的金属条 + 木柄）
    rect(img, 25, 21, 26, 24, X.TOOL)       # 金属杆
    rect(img, 26, 24, 27, 25, X.TOOL_HANDLE)  # 木柄
    px(img, 26, 23, X.TOOL_S)
    px(img, 25, 21, X.TOOL_S)

    # —— 头：橙金短发 + 脸 ——
    # 脖子
    rect(img, 13, 14, 18, 15, C.SKIN)
    hline(img, 13, 18, 15, C.SKIN_SHADOW)
    # 脸
    draw_face_down_32(img, skin=C.SKIN,
                      hair=X.HAIR, hair_mid=X.HAIR_MID, hair_s=X.HAIR_S,
                      eye_y=9, left_eye_x=12, right_eye_x=18,
                      brow=True, nose=True, mouth=True, cheek=True)
    # 头顶短发（橙金，y 0-4，偏短齐刘海）
    rect(img, 9, 0, 22, 1, X.HAIR)
    rect(img, 8, 2, 23, 3, X.HAIR)
    rect(img, 9, 4, 22, 4, X.HAIR)
    # 刘海分缝
    px(img, 15, 0, X.HAIR_S)
    px(img, 16, 0, X.HAIR_S)
    # 刘海高光绺
    for x in (11, 13, 18, 20):
        if (x + 0) % 2 == 0:
            px(img, x, 0, X.HAIR_MID)
    px(img, 12, 2, X.HAIR_MID)
    px(img, 19, 2, X.HAIR_MID)
    # 两侧鬓发（短）
    px(img, 8, 4, X.HAIR)
    px(img, 23, 4, X.HAIR)
    px(img, 7, 5, X.HAIR_S)
    px(img, 24, 5, X.HAIR_S)
    # 头顶发旋阴影
    px(img, 15, 2, X.HAIR_S)
    px(img, 16, 2, X.HAIR_S)

    add_outline(img, C.OUTLINE)
    return img


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "sprites", "npc_xiya.png")
    img = npc_xiya_frame_32()
    img.save(out)
    print(f"[OK] {out} {img.size}")
