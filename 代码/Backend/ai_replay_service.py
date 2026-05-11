#!/usr/bin/env python3
"""
AI复盘服务
提供HTTP接口用于游戏复盘分析
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import json
import logging
from datetime import datetime

# 添加当前目录到Python路径，以便导入ai_replayer模块
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from ai_replayer import analyze_game_record
except ImportError:
    print("错误: 无法导入ai_replayer模块，请确保ai_replayer.py在同一目录下")
    sys.exit(1)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置
DEFAULT_OUTPUT_DIR = os.path.join(os.getcwd(), 'replay_analysis')
DEFAULT_AI_CONFIG = {
    'model': 'gpt-4',
    'baseurl': None  # 可以设置为你的API端点
}

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'ok',
        'service': 'ai_replay_service',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/analyze', methods=['POST'])
def analyze_game():
    """游戏复盘分析接口"""
    try:
        data = request.get_json()
        
        # 验证必需参数
        if not data or 'game_record' not in data:
            return jsonify({
                'error': '缺少必需参数: game_record'
            }), 400
        
        game_record = data['game_record']
        ai_config = data.get('ai_config')
        output_dir = data.get('output_dir', DEFAULT_OUTPUT_DIR)
        desensitize = data.get('desensitize', True)
        
        # 验证game_record格式
        if not isinstance(game_record, dict):
            return jsonify({
                'error': 'game_record必须是字典格式'
            }), 400
        
        # 设置默认AI配置
        if ai_config and isinstance(ai_config, dict):
            # 如果提供了api_key_env，从环境变量读取
            if 'api_key_env' in ai_config:
                api_key = os.getenv(ai_config['api_key_env'])
                if api_key:
                    ai_config['api_key'] = api_key
                del ai_config['api_key_env']
        
        logger.info(f"开始分析游戏记录，输出目录: {output_dir}")
        
        # 调用分析函数
        result = analyze_game_record(
            game_record=game_record,
            ai_config=ai_config,
            output_dir=output_dir,
            desensitize=desensitize
        )
        
        logger.info(f"分析完成，生成文件: {result}")
        
        return jsonify({
            'success': True,
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"分析过程中发生错误: {str(e)}")
        return jsonify({
            'error': f'分析失败: {str(e)}'
        }), 500

@app.route('/analyze_async', methods=['POST'])
def analyze_game_async():
    """异步游戏复盘分析接口（返回任务ID）"""
    # 这里可以实现异步处理逻辑
    # 目前返回同步结果作为占位
    return analyze_game()

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': '接口不存在'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': '服务器内部错误'}), 500

if __name__ == '__main__':
    # 确保输出目录存在
    os.makedirs(DEFAULT_OUTPUT_DIR, exist_ok=True)
    
    # 启动服务
    port = int(os.getenv('AI_REPLAY_PORT', 8002))
    debug = os.getenv('AI_REPLAY_DEBUG', 'false').lower() == 'true'
    
    print(f"AI复盘服务启动中...")
    print(f"端口: {port}")
    print(f"调试模式: {debug}")
    print(f"输出目录: {DEFAULT_OUTPUT_DIR}")
    print(f"健康检查: http://localhost:{port}/health")
    print(f"分析接口: http://localhost:{port}/analyze")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
