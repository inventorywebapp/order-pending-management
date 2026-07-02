from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import os
from datetime import datetime
import json
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

class OrderProcessor:
    def __init__(self):
        self.orders = []
        self.deliveries = []
        self.actual = []
        self.pending = []
    
    def load_excel_file(self, file_path, file_type):
        """Load and parse Excel file"""
        try:
            df = pd.read_excel(file_path)
            data = []
            
            for _, row in df.iterrows():
                if file_type == 'order':
                    entry = {
                        'sku': str(row.get('SKU', '')),
                        'qty': float(row.get('Order Qty', 0)),
                        'supplier': str(row.get('Supplier', '')),
                        'orderDate': str(row.get('Order Date', '')),
                        'orderCode': str(row.get('Order Code', ''))
                    }
                elif file_type == 'delivery':
                    entry = {
                        'sku': str(row.get('SKU', '')),
                        'qty': float(row.get('Delivery Qty', 0)),
                        'supplier': str(row.get('Supplier', '')),
                        'deliveryDate': str(row.get('Est. Delivery Date', '')),
                        'boxCode': str(row.get('Box Code', ''))
                    }
                elif file_type == 'actual':
                    entry = {
                        'sku': str(row.get('SKU', '')),
                        'qty': float(row.get('Delivery Qty', 0)),
                        'supplier': str(row.get('Supplier', '')),
                        'actualDate': str(row.get('Act. Delivery Date', '')),
                        'boxCode': str(row.get('Box Code', ''))
                    }
                data.append(entry)
            
            return data
        except Exception as e:
            print(f"Error loading file {file_path}: {str(e)}")
            return []
    
    def process_pending_orders(self):
        """Process pending orders based on deliveries"""
        # Aggregate orders by SKU and supplier
        order_map = {}
        for order in self.orders:
            key = f"{order['sku']}-{order['supplier']}"
            if key not in order_map:
                order_map[key] = {
                    'sku': order['sku'],
                    'supplier': order['supplier'],
                    'totalOrder': 0,
                    'delivered': 0,
                    'orders': []
                }
            order_map[key]['totalOrder'] += order['qty']
            order_map[key]['orders'].append(order)
        
        # Aggregate deliveries
        delivery_map = {}
        for delivery in self.deliveries:
            key = f"{delivery['sku']}-{delivery['supplier']}"
            delivery_map[key] = delivery_map.get(key, 0) + delivery['qty']
        
        # Calculate pending
        pending = []
        for key, value in order_map.items():
            delivered = delivery_map.get(key, 0)
            remaining = value['totalOrder'] - delivered
            
            if remaining > 0 or delivered > 0:
                status = 'completed' if remaining == 0 else ('partial' if delivered > 0 else 'pending')
                pending.append({
                    'sku': value['sku'],
                    'supplier': value['supplier'],
                    'totalOrder': value['totalOrder'],
                    'delivered': delivered,
                    'remaining': max(0, remaining),
                    'status': status,
                    'orderDate': value['orders'][0]['orderDate'],
                    'orderCode': value['orders'][0]['orderCode']
                })
        
        # Sort by date (oldest first)
        pending.sort(key=lambda x: x['orderDate'])
        self.pending = pending

@app.route('/api/process-order', methods=['POST'])
def process_order():
    """Process order files"""
    try:
        files = request.files
        processor = OrderProcessor()
        
        # Process order files
        if 'orders' in files:
            order_file = files['orders']
            order_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp_order.xlsx')
            order_file.save(order_path)
            processor.orders = processor.load_excel_file(order_path, 'order')
            os.remove(order_path)
        
        # Process delivery files
        if 'deliveries' in files:
            delivery_file = files['deliveries']
            delivery_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp_delivery.xlsx')
            delivery_file.save(delivery_path)
            processor.deliveries = processor.load_excel_file(delivery_path, 'delivery')
            os.remove(delivery_path)
        
        # Process actual files
        if 'actual' in files:
            actual_file = files['actual']
            actual_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp_actual.xlsx')
            actual_file.save(actual_path)
            processor.actual = processor.load_excel_file(actual_path, 'actual')
            os.remove(actual_path)
        
        # Process pending orders
        processor.process_pending_orders()
        
        return jsonify({
            'success': True,
            'data': {
                'orders': processor.orders,
                'deliveries': processor.deliveries,
                'actual': processor.actual,
                'pending': processor.pending
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/get-data', methods=['GET'])
def get_data():
    """Get processed data"""
    try:
        # This would typically fetch from database or file system
        # For now, return sample data
        return jsonify({
            'success': True,
            'data': {
                'orders': [],
                'deliveries': [],
                'actual': [],
                'pending': []
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Analyze order data"""
    try:
        data = request.json
        analysis_type = data.get('type', 'supplier')
        
        # Perform analysis based on type
        results = []
        
        if analysis_type == 'supplier':
            # Group by supplier
            supplier_data = {}
            for item in data.get('pending', []):
                supplier = item.get('supplier')
                if supplier not in supplier_data:
                    supplier_data[supplier] = {'total': 0, 'pending': 0, 'completed': 0}
                supplier_data[supplier]['total'] += item.get('totalOrder', 0)
                if item.get('status') == 'completed':
                    supplier_data[supplier]['completed'] += item.get('totalOrder', 0)
                else:
                    supplier_data[supplier]['pending'] += item.get('remaining', 0)
            
            for supplier, stats in supplier_data.items():
                results.append({
                    'name': supplier,
                    'total': stats['total'],
                    'pending': stats['pending'],
                    'completed': stats['completed'],
                    'completionRate': (stats['completed'] / stats['total'] * 100) if stats['total'] > 0 else 0
                })
        
        return jsonify({'success': True, 'data': results})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export', methods=['POST'])
def export():
    """Export data as CSV"""
    try:
        data = request.json
        pending = data.get('pending', [])
        
        # Create DataFrame
        df = pd.DataFrame(pending)
        
        # Export to CSV
        filename = f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        df.to_csv(filepath, index=False)
        
        return send_file(filepath, as_attachment=True)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    # Create upload folder if it doesn't exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)
