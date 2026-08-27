/**
 * StorySequenceRunner — P7c-b 剧情序列编排器
 *
 * 职责：
 *   - 编排对话序列的播放
 *   - 通过 Hooks/回调触发副作用
 *   - 保持与 MapScene 的松耦合
 *
 * 设计原则：
 *   - 纯编排层：不直接持有游戏状态，通过 Hooks 回调
 *   - 可测试：对话序列可独立验证
 *   - 不修改原方法签名：try*Interact() 仍返回 boolean
 *
 * 与 MapScene 的关系：
 *   MapScene (场景编排层)
 *     ├── 场景切换
 *     ├── UI 面板管理
 *     ├── 资源检查/消耗
 *     └── 通过 Hooks 调用 StorySequenceRunner
 *
 *   StorySequenceRunner (剧情编排层)
 *     ├── 接收对白请求
 *     ├── 编排对话序列
 *     ├── 执行对话播放
 *     └── 通过回调触发副作用 (triggerOnce/save)
 */

import type { DialogueLine } from '../systems/StorySystem';
import type { StoryDialogue } from '../ui/StoryDialogue';

/**
 * 剧情序列 Hooks 接口
 * StorySequenceRunner 通过这些回调触发副作用
 * 不直接调用 triggerOnce/save/addItem 等函数
 */
export interface StorySequenceHooks {
  /** 对话开始前的回调 */
  onDialogueStart?: () => void;
  /** 对话结束后的回调 */
  onDialogueEnd?: () => void;
  /** triggerOnce 封装 */
  triggerOnce?: (key: string, fn?: () => void) => boolean;
  /** save 封装 */
  save?: () => void;
  /** addItem 封装 */
  addItem?: (item: string, count: number) => void;
  /** showMemoryMoment 封装 */
  showMemoryMoment?: (text: string) => void;
  /** updateHUD 封装 */
  updateHUD?: () => void;
}

/**
 * 对话序列定义
 * 描述一段可播放的对话序列
 */
export interface DialogueSequence {
  /** 序列唯一标识（用于日志和调试） */
  id: string;
  /** 对话行数组 */
  lines: DialogueLine[];
  /** 可选：对话结束时的副作用回调 */
  onComplete?: () => void;
  /** 可选：对话选项处理 */
  onChoice?: (index: number) => void;
}

/**
 * 剧情序列编排器
 *
 * 使用：
 *   const runner = new StorySequenceRunner(dialogueInstance);
 *   runner.playSequence({ id: 'dawn_xiya', lines: [...] });
 *   // 对话播放中时，runner.isPlaying() 返回 true
 */
export class StorySequenceRunner {
  private dialogue: StoryDialogue | null = null;
  private dialogueFactory: (() => StoryDialogue) | null = null;
  private hooks: StorySequenceHooks;
  private playing = false;
  private currentSequenceId: string | null = null;

  constructor(dialogue: StoryDialogue | null = null, hooks: StorySequenceHooks = {}) {
    this.dialogue = dialogue;
    this.hooks = hooks;
  }

  /**
   * 设置 StoryDialogue 实例
   * 在 MapScene 创建 StoryDialogue 后调用
   */
  public setDialogue(dialogue: StoryDialogue): void {
    this.dialogue = dialogue;
  }

  /**
   * 设置 dialogue 工厂函数
   * 当 dialogue 为 null 时，通过工厂函数自动创建
   * 这是统一入口的关键——消除外部的 if (!storyDialogue) 守卫
   */
  public setDialogueFactory(factory: () => StoryDialogue): void {
    this.dialogueFactory = factory;
  }

  /**
   * 获取或创建 StoryDialogue 实例
   * @returns StoryDialogue 实例
   */
  private ensureDialogue(): StoryDialogue | null {
    if (this.dialogue) return this.dialogue;
    if (this.dialogueFactory) {
      this.dialogue = this.dialogueFactory();
      return this.dialogue;
    }
    return null;
  }

  /**
   * 设置或更新 Hooks
   */
  public setHooks(hooks: StorySequenceHooks): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  /**
   * 播放一段对话序列
   *
   * @param seq 对话序列定义
   * @returns 是否成功开始播放（如果正在播放返回 false）
   */
  public playSequence(seq: DialogueSequence): boolean {
    // 确保 dialogue 已初始化（支持自动工厂创建）
    const dialogue = this.ensureDialogue();
    if (!dialogue || this.playing) return false;

    this.playing = true;
    this.currentSequenceId = seq.id;

    // 触发 onDialogueStart 回调
    if (this.hooks.onDialogueStart) {
      this.hooks.onDialogueStart();
    }

    // 播放对话
    dialogue.play(
      seq.lines,
      () => {
        // 对话结束
        this.playing = false;
        this.currentSequenceId = null;

        // 触发序列完成回调
        if (seq.onComplete) {
          seq.onComplete();
        }

        // 触发 onDialogueEnd 回调
        if (this.hooks.onDialogueEnd) {
          this.hooks.onDialogueEnd();
        }

        // 更新 HUD
        if (this.hooks.updateHUD) {
          this.hooks.updateHUD();
        }
      },
      seq.onChoice,
    );

    return true;
  }

  /**
   * 播放简单对话（仅行数组，无额外配置）
   *
   * @param lines 对话行数组
   * @param onComplete 可选：对话结束回调
   * @returns 是否成功开始播放
   */
  public play(lines: DialogueLine[], onComplete?: () => void): boolean {
    return this.playSequence({
      id: 'inline',
      lines,
      onComplete,
    });
  }

  /**
   * 检查是否正在播放对话
   */
  public isPlaying(): boolean {
    return this.playing;
  }

  /**
   * 获取当前序列 ID
   */
  public getCurrentSequenceId(): string | null {
    return this.currentSequenceId;
  }

  /**
   * 中断当前对话
   * 注意：这不会触发 onComplete 回调
   */
  public interrupt(): void {
    if (!this.playing) return;
    this.playing = false;
    this.currentSequenceId = null;
    // 重置对话 UI
    const dialogue = this.ensureDialogue();
    if (dialogue) {
      dialogue.reset();
    }
  }

  /**
   * 便捷方法：创建并播放一段简单对白
   * 这是最常用的场景——"根据条件播放一段对白"
   *
   * @param id 序列标识符（用于日志）
   * @param lines 对话行数组
   * @param onComplete 可选：对话结束回调
   * @returns 是否成功开始播放
   */
  public playDialogue(id: string, lines: DialogueLine[], onComplete?: () => void): boolean {
    return this.playSequence({ id, lines, onComplete });
  }

  /**
   * 便捷方法：播放带选项的对白
   *
   * @param id 序列标识符
   * @param lines 对话行数组（需包含 options 字段）
   * @param onChoice 选项处理回调
   * @param onComplete 可选：对话结束回调
   * @returns 是否成功开始播放
   */
  public playWithOptions(
    id: string,
    lines: DialogueLine[],
    onChoice: (index: number) => void,
    onComplete?: () => void,
  ): boolean {
    return this.playSequence({ id, lines, onComplete, onChoice });
  }

  /**
   * 原始播放接口：直接替代 storyDialogue.play() 调用
   *
   * 这是统一入口——所有原 storyDialogue.play(lines, onComplete, onChoice)
   * 调用都应迁移到这里，确保对话播放经过 StorySequenceRunner 编排。
   *
   * @param lines 对话行数组
   * @param onComplete 可选：对话结束回调
   * @param onChoice 可选：选项处理回调
   * @param seqId 可选：序列标识符（用于日志）
   * @returns 是否成功开始播放
   */
  public playRaw(
    lines: DialogueLine[],
    onComplete?: () => void,
    onChoice?: (index: number) => void,
    seqId?: string,
  ): boolean {
    return this.playSequence({
      id: seqId || 'inline',
      lines,
      onComplete,
      onChoice,
    });
  }
}
