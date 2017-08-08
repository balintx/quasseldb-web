<?php

set_error_handler("log_errors");
function log_errors(...$args)
{
	error_log("[QuasselDB AJAX Heart] PHP Error: ".implode(', ', $args));
	return true;
}

define('FILENAME_LOGIN', 'login.html');
define('FILENAME_CONTENT', 'content.html');
define('TIMEOUT_SECONDS', 60*60);
define('RESULT_HARD_LIMIT', 50);

session_start();

$db = ($_SESSION['data']['db'] ?? ($_POST['db'] ?? 0));
switch ($db)
{
	case 1:
		$db = 'quasselfoo';
	break;
	case 2:
		$db = 'quasselbar';
	break;
	default:
		$db = 'quassel';
	break;
}

$db_config = ['localhost', 'quassel', 'quassel password here', $db];
require 'quasseldb-php/quasseldb.php';

$qdb = new QuasselDB();

$success = $qdb->Connect($db_config);
if ($success !== true)
{
	trigger_error("QuasselDB->Connect failed with $success");
	die("[]");
}

// check logout
if (isset($_GET['logout']))
{
	unset($_SESSION['data']);
	die(json_encode(['location' => FILENAME_LOGIN]));
}

// check login
if (isset($_POST['login_username']) && isset($_POST['login_password']))
{
	if ($qdb->Authenticate($_POST['login_username'], $_POST['login_password']))
	{
		$uid = $qdb->user_id;
		list($hash,) = $qdb->Get_HashData($uid);
		$_SESSION['data']['uid'] = $uid;
		$_SESSION['data']['hash'] = $hash;
		if (isset($_POST['db'])) $_SESSION['data']['db'] = $_POST['db'];
		UpdateSession();
		die(json_encode(['success' => true, 'location' => FILENAME_CONTENT]));
	}
	else
	{
		error_log("[QuasselDB Ajax Heart] Failed login for '".trim($_POST['login_username'])."' on database '$db' from IP '".$_SERVER['REMOTE_ADDR']."'");
		die(json_encode(['success' => false, 'location' => FILENAME_LOGIN]));
	}
}

// check session
if (isset($_SESSION['data']['connection']))
{
	if (time() - $_SESSION['data']['connection']['ts'] > TIMEOUT_SECONDS ||
		$_SESSION['data']['connection']['ip'] != $_SERVER['REMOTE_ADDR'] ||
		$_SESSION['data']['connection']['ua'] != $_SERVER['HTTP_USER_AGENT'] ||
		!$qdb->Authenticate_WithHash($_SESSION['data']['uid'], $_SESSION['data']['hash'])
	)
	{
		unset($_SESSION['data']);
		die(json_encode(['location' => FILENAME_LOGIN]));
	}
	else
	{
		UpdateSession();
	}
}
else
{
	die(json_encode(['location' => FILENAME_LOGIN]));
}
function UpdateSession()
{
	$_SESSION['data']['connection']['ip'] = $_SERVER['REMOTE_ADDR'];
	$_SESSION['data']['connection']['ua'] = $_SERVER['HTTP_USER_AGENT'];
	$_SESSION['data']['connection']['ts'] = time();
}

// check other requests
if (isset($_GET['get_buffers']))
{
	$my_buffers = $qdb->Get_Buffers();
	$reply = [];
	$networknames = $qdb->Get_Network(array_keys($my_buffers));
	foreach ($my_buffers as $networkid => $buffers)
	{
		$reply[] = [
			'network_id' => $networkid,
			'network_name' => $networknames[$networkid],
			'buffers' => $buffers
		];
	}
	die(json_encode($reply));
}

if (isset($_GET['search']))
{
	//$_POST = $_GET;
	$search_array = [];
	$dates = [];
	$buffers = [];
	if (isset($_POST['search_string']))
	{
		$search_array[QuasselDB_Constants::Search_String] = $_POST['search_string'];
	}
	
	if (isset($_POST['search_date1']))
	{
		$date = new DateTime($_POST['search_date1']);
		$dates[] = $date->getTimeStamp();
	}
	if (isset($_POST['search_date2']))
	{
		$date = new DateTime($_POST['search_date2']);
		$dates[] = $date->getTimeStamp();
	}
	if (count($dates) == 2)
	{
		$search_array[QuasselDB_Constants::Search_Date] = $dates;
	}
	if (isset($_POST['search_sender']))
	{
		$search_array[QuasselDB_Constants::Search_Sender] = $_POST['search_sender'];
	}
	if (isset($_POST['buffers']))
	{
		$buffers = explode(',', $_POST['buffers']);
	}
	$limit = 1;
	if (isset($_POST['limit']))
	{
		$limit = $_POST['limit'];
	}
	if ($limit > RESULT_HARD_LIMIT) $limit = RESULT_HARD_LIMIT;
	//$types = array_filter($types, function($e) { return in_array($e, QuasselDB_Constants::BacklogEntry_All_Types); });
	//$types = QuasselDB_Constants::BacklogEntry_All_Types;
	
	$results = $qdb->Search($search_array, $buffers, $limit);
	
	die(json_encode(AddSenderData($results)));
}

if (isset($_GET['moremessages']))
{
	$messageid = $_POST['messageid'] ?? '';
	$bufferid = $_POST['bufferid'] ?? '';
	$limit = $_POST['limit'] ?? 0;
	$direction_flags = $_POST['direction'] ?? 0;

	if ($limit > RESULT_HARD_LIMIT) $limit = RESULT_HARD_LIMIT;
	die(json_encode(AddSenderData($qdb->Get_MessagesNearID($messageid, $bufferid, (int)$limit, $direction_flags))));
}

if (isset($_GET['location']))
{
	die(json_encode(['location' => FILENAME_CONTENT]));
}

if (isset($_GET['change_password']))
{
	die(json_encode(['success' => $qdb->Change_Password($_POST['newpassword'], $_POST['oldpassword'])]));
}

function AddSenderData($results)
{
	global $qdb;
	$req = [];
	foreach ($results as &$result)
	{
		if (isset($result['senderid'])) $req[] = $result['senderid'];
	}
	$senders = $qdb->Get_Sender($req);
	foreach ($results as &$result)
	{
		$sender = $senders[$result['senderid']] ?? '(?)';
		@list($result['sender'], $result['sender_details']) = explode('!', $sender, 2);
		$result['sender_details'] = $result['sender'].'!'.$result['sender_details'];
	}
	return $results;
}
