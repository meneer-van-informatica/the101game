<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

$base = realpath(__DIR__ . '/../chain');
if ($base === false) { $base = __DIR__ . '/../chain'; }
if (!is_dir($base)) { @mkdir($base, 0775, true); }

$file = $base . '/chain.json';
$op   = $_GET['op'] ?? 'append';
$ip   = $_SERVER['REMOTE_ADDR'] ?? '';
$ua   = $_SERVER['HTTP_USER_AGENT'] ?? '';
$path = $_GET['path'] ?? ($_SERVER['REQUEST_URI'] ?? '');
$owner= $_COOKIE['owner'] ?? 'guest'; // TODO: replace with real login later

$chain = [];
if (is_file($file)) {
  $json = @file_get_contents($file);
  $chain = json_decode($json, true) ?: [];
}

if ($op === 'append') {
  $i    = count($chain);
  $prev = $i ? ($chain[$i-1]['hash'] ?? '') : str_repeat('0',64);
  $data = ['owner'=>$owner,'ua'=>$ua,'ip'=>$ip,'path'=>$path,'ts'=>time()];
  $payload = ['i'=>$i,'prev'=>$prev,'data'=>$data];
  $hash = hash('sha256', json_encode($payload, JSON_UNESCAPED_SLASHES));

  $block = $payload + ['hash'=>$hash];

  $fp = @fopen($file, 'c+');
  if (!$fp) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'storage unavailable']); exit; }

  flock($fp, LOCK_EX);
  $existing = '';
  $size = filesize($file);
  if ($size && $size > 0) { $existing = stream_get_contents($fp); }
  $arr = $existing ? (json_decode($existing, true) ?: []) : [];
  $arr[] = $block;
  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, json_encode($arr, JSON_UNESCAPED_SLASHES));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);
  $chain = $arr;
}

$res = ['ok'=>true,'length'=>count($chain)];
if (($_GET['view'] ?? '') === 'full') { $res['chain'] = $chain; }
echo json_encode($res);
?>
