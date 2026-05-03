import { sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { scenario } from 'k6/execution';
import http from 'k6/http';
import { Trend } from 'k6/metrics';

const data = new SharedArray('requests', function () {
  return JSON.parse(open('../data/requests.json')).filter((it) => !it.startsWith('/search'));
});

const host = __ENV.HOST || `http://192.168.31.144:3000`;

const endpointTrends = {
  '/customers': new Trend('endpoint_customers_duration', true),
  '/customer-by-id': new Trend('endpoint_customer_by_id_duration', true),
  '/employees': new Trend('endpoint_employees_duration', true),
  '/employee-with-recipient': new Trend('endpoint_employee_with_recipient_duration', true),
  '/suppliers': new Trend('endpoint_suppliers_duration', true),
  '/supplier-by-id': new Trend('endpoint_supplier_by_id_duration', true),
  '/products': new Trend('endpoint_products_duration', true),
  '/product-with-supplier': new Trend('endpoint_product_with_supplier_duration', true),
  '/orders-with-details': new Trend('endpoint_orders_with_details_duration', true),
  '/order-with-details': new Trend('endpoint_order_with_details_duration', true),
  '/order-with-details-and-products': new Trend('endpoint_order_with_details_and_products_duration', true),
};

export const options = {
  stages: [
    { duration: '5s', target: 200 },
    { duration: '15s', target: 200 },
    { duration: '5s', target: 400 },
    { duration: '15s', target: 400 },
    { duration: '5s', target: 600 },
    { duration: '15s', target: 600 },
    { duration: '5s', target: 800 },
    { duration: '15s', target: 800 },
    { duration: '5s', target: 1000 },
    { duration: '15s', target: 1000 },
    { duration: '5s', target: 1200 },
    { duration: '15s', target: 1200 },
    { duration: '5s', target: 1400 },
    { duration: '15s', target: 1400 },
    { duration: '5s', target: 1600 },
    { duration: '15s', target: 1600 },
    { duration: '5s', target: 1800 },
    { duration: '15s', target: 1800 },
    { duration: '5s', target: 2000 },
    { duration: '15s', target: 2000 },
    { duration: '5s', target: 2200 },
    { duration: '15s', target: 2200 },
    { duration: '5s', target: 2400 },
    { duration: '15s', target: 2400 },
    { duration: '5s', target: 2600 },
    { duration: '15s', target: 2600 },
    { duration: '5s', target: 2800 },
    { duration: '15s', target: 2800 },
    { duration: '5s', target: 3000 },
    { duration: '55s', target: 3000 },
  ],
};

function endpointOf(path) {
  return path.split('?')[0];
}

export default function () {
  const requestPath = data[scenario.iterationInTest % data.length];
  const endpoint = endpointOf(requestPath);
  const response = http.get(`${host}${requestPath}`, {
    tags: { endpoint, name: endpoint },
    timeout: '30s',
  });

  endpointTrends[endpoint]?.add(response.timings.duration);

  sleep(0.075 * (scenario.iterationInTest % 6));
}
