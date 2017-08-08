/*

  QuasselDB Web Interface
  JavaScript backend
  
  Created by: balintx

*/

var BacklogEntry_Type_Plain = 0x00001;
var BacklogEntry_Type_Notice = 0x00002;
var BacklogEntry_Type_Action = 0x00004;
var BacklogEntry_Type_Nick = 0x00008;
var BacklogEntry_Type_Mode = 0x00010;
var BacklogEntry_Type_Join = 0x00020;
var BacklogEntry_Type_Part = 0x00040;
var BacklogEntry_Type_Quit = 0x00080;
var BacklogEntry_Type_Kick = 0x00100;
var BacklogEntry_Type_Kill = 0x00200;
var BacklogEntry_Type_Server = 0x00400;
var BacklogEntry_Type_Info = 0x00800;
var BacklogEntry_Type_Error = 0x01000;
var BacklogEntry_Type_DayChange = 0x02000;
var BacklogEntry_Type_Topic = 0x04000;
var BacklogEntry_Type_NetsplitJoin = 0x08000;
var BacklogEntry_Type_NetsplitQuit = 0x10000;
var BacklogEntry_Type_Invite = 0x20000;
var QuasselDB_Constants_Direction_Previous = 1 << 0;
var QuasselDB_Constants_Direction_Next = 1 << 1;
var QuasselDB_Constants_Original_Message = 1 << 2;

var classes = ['no-nav-link', 'date', 'network', 'channel', 'sender', 'message'];

var selected_buffers = '';
var opened_messages = [];
var bufferids = [];
var buffers = [];

window.addEventListener('load', function() {
	
	flatpickr(".date_input", {
		enableTime: true,
		time_24hr: true,
		allowInput: true,
		defaultHour: 0,
		defaultMinute: 1,
		enableSeconds: true}
	);
	
	document.getElementById('search_submit_button').addEventListener('click', function(e) {
		e.preventDefault();
		Search();
	});
	
	document.getElementById('logout_button').addEventListener('click', function(e) {
		e.preventDefault();
		Logout();
	});
	
	document.getElementById('change_password_button').addEventListener('click', function(e) {
		e.preventDefault();
		ChangePassword();
	});
	
	LoadBuffers();
});

function LoadBuffers() {
	var e = document.getElementById('select_buffers');
	e.innerHTML = '<optgroup id="optdummy"></optgroup>';
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState != 4 || this.status != 200) { return; }
		r = JSON.parse(this.responseText);
		if (r.location != null) {
			location.href = r.location;
		} else {
			var lastElement = e.firstChild;
			for (var i = 0; i < r.length; i++) {
				var newElement = AddElemAfterId(lastElement.id, 'optgroup');
				newElement.id = 'network_' + r[i].network_id;
				newElement.label = r[i].network_name;
				newElement.innerHTML = '<option id="_optdummy">...loading...</option>';
				_lastElement = newElement.firstChild;
				for (var j = 0; j < r[i].buffers.length; j++) {
					var _newElement = AddElemAfterId(_lastElement.id, 'option');
					var bufferid = r[i].buffers[j][0];;
					var buffername = r[i].buffers[j][1];
					_newElement.id = 'buffer_' + bufferid;
					_newElement.value = bufferid;
					_newElement.innerHTML = buffername;
					_lastElement = _newElement;
					buffers[bufferid] = {'name': buffername, 'network_name': r[i].network_name}
				}
				CloseElementById('_optdummy');
				lastElement = newElement;
			}
			CloseElementById('optdummy');
		}
	};
	xhttp.open("GET", "heart.php?get_buffers", true);
	xhttp.send();
}

function Logout() {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
	if (this.readyState != 4 || this.status != 200) { return; }
	r = JSON.parse(this.responseText);
	if (r.location != null) {
		location.href = r.location;
	}
	}
	xhttp.open("GET", "heart.php?logout", true);
	xhttp.send();
}

function ChangePassword() {
	var oldpass = prompt("Your current password:");
	if (oldpass == null) return;
	var newpass = prompt("New password:");
	if (newpass == null) return;
	if (prompt("New password again:") != newpass) {
		alert('Passwords do not match');
		return;
	}
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState != 4 || this.status != 200) { return; }
		r = JSON.parse(this.responseText);
		if (r.success) {
			alert('Password changed!');
			LoadBuffers();
		} else {
			alert('Password change error, try again');
		}
	}
	xhttp.open("POST", "heart.php?change_password", true);
	xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	xhttp.send('newpassword=' + encodeURIComponent(newpass) + '&oldpassword=' + encodeURIComponent(oldpass));
}

function AddElemBeforeId(Id, elementname){
	var target = document.getElementById(Id);
	var newElement = document.createElement(elementname);
	target.parentNode.insertBefore(newElement, target);
	return newElement;
}

function AddElemAfterId(Id, elementname){
	var target = document.getElementById(Id);
	var newElement = document.createElement(elementname);
	target.parentNode.insertBefore(newElement, target.nextSibling);
	return newElement;
}

function Extract_MessageId(text)
{
	return parseInt(new RegExp("[0-9]*$").exec(text)[0]);
}

function Extract_OpenedMessageId(text)
{
	return parseInt(new RegExp("([0-9]+)_[0-9]*$").exec(text)[1]);
}

function CloseElementById(elementid)
{
	var elem = document.getElementById(elementid);
	elem.parentNode.removeChild(elem);
}

function ParseBacklogEntryLine(entry, element) {
	var parsed = [ null, entry['time'], buffers[entry['bufferid']]['network_name'], buffers[entry['bufferid']]['name'], entry['sender'], '* UNKNOWN (Type: ' + entry['type'] + ') ' + entry['message']];
	bufferids[entry['messageid']] = entry['bufferid'];
	// table rows as parsed[] indexes:
	// 0: unused 1: date 2: network name 3: channel name 4: sender 5: message
	parsed[4] = '<details><summary>' + entry['sender'] + '</summary><p>' + entry['sender_details'] + '</p></details>';
	switch (entry['type']) {
		case BacklogEntry_Type_Action:
			element.className = 'message_line_action';
			parsed[5] = '* ACTION: ' + entry['sender'] + ' ' + entry['message'];
		break;
		case BacklogEntry_Type_Info:
			element.className = 'message_line_info';
		break;
		case BacklogEntry_Type_Invite:
			element.className = 'message_line_invite';
			parsed[5] = '* ' + entry['message'];
		break;
		case BacklogEntry_Type_Join:
			element.className = 'message_line_join';
			parsed[5] = '* Joined <span className="channel">' + entry['message'] + '</span>';
		break;
		case BacklogEntry_Type_Kick:
			element.className = 'message_line_kick';
			var pos = entry['message'].indexOf(' ');
			var parts = null;
			if (pos == -1) {
				parts = [entry['message'], ''];
			} else {
				parts = [entry['message'].substr(0, pos), entry['message'].substr(pos + 1)];
			}
			parsed[5] = '* Kicked ' + parts[0] + ' (' + parts[1] + ')';
		break;
		case BacklogEntry_Type_Mode:
			element.className = 'message_line_mode';
			parsed[5] = '* Mode change: ' + entry['message'];
		break;
		case BacklogEntry_Type_NetsplitJoin:
			element.className = 'message_line_netsplitjoin';
			parsed[4] = 'NET SPLIT';
			parsed[5] = '* Reconnected: ' + entry['message'];
		break;
		case BacklogEntry_Type_NetsplitQuit:
			element.className = 'message_line_quit';
			parsed[4] = 'NET SPLIT';
			parsed[5] = '* Disconnected: ' + entry['message'];
		break;
		case BacklogEntry_Type_Nick:
			element.className = 'message_line_nick';
			parsed[5] = '* Changed nick to: ' + entry['message'];
		break;
		case BacklogEntry_Type_Notice:
			element.className = 'message_line_notice';
			parsed[5] = '* NOTICE: ' + entry['message'];
		break;
		case BacklogEntry_Type_Part:
			element.className = 'message_line_part';
			parsed[5] = 'Left channel ' + parsed[3] + ' ( ' + entry['message'] + ' )';
		break;
		case BacklogEntry_Type_Plain:
			element.className = 'message_line_plain';
			parsed[5] = entry['message'];
		break;
		case BacklogEntry_Type_Quit:
			element.className = 'message_line_quit';
			parsed[5] = '* Disconnected: ' + entry['message'];
		break;
		case BacklogEntry_Type_Server:
			element.className = 'message_line_server';
			parsed[5] = '*** ' + entry['message'];
		break;
		case BacklogEntry_Type_Topic:
			element.className = 'message_line_topic';
			parsed[5] = entry['message'];
		break;
	}
	return parsed;
}

function FillRowWithReply(reply, element) {
	var cols = ParseBacklogEntryLine(reply, element);
	for (var j = 0; j < cols.length; j++) {
		var cell = element.insertCell(j);
		cell.className = classes[j];
		cell.innerHTML = cols[j];
	}
}

function SaveSelectedBuffers() {
	var sel = document.getElementById('select_buffers');
	var buffers = [];
	for (var i = 0; i < sel.length; i++) {
		if (sel[i].selected) buffers.push(sel[i].value);
	}
	selected_buffers = buffers.join(',');
}

function Search() {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState != 4 || this.status != 200) { return; }
		reply = JSON.parse(this.responseText);
		var table = document.getElementById('messages');
		table.innerHTML = '';
		for (var i = 0; i < reply.length; i++) {
			var row = table.insertRow(i);
			row.id = 'message_id_' + reply[i]['messageid'];
			FillRowWithReply(reply[i], row);
			row.firstChild.innerHTML = '<a href="#" id="open_message_id_' + reply[i]['messageid'] + '" onclick="MoreMessages(this.id, QuasselDB_Constants_Direction_Next | QuasselDB_Constants_Direction_Previous | QuasselDB_Constants_Original_Message); return false;"><span>Show more messages</span></a>';
			row.firstChild.className = 'open-link';
		}
	}
	xhttp.open("POST", "heart.php?search", true);
	xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	
	SaveSelectedBuffers();
	opts = [];
	
	elem = document.getElementById('search_form').elements;
	
	for (var i = 0; i < elem.length; i++) {
		if (elem[i].value !== '')
			opts.push(elem[i].name + '=' + encodeURIComponent(elem[i].value.trim()));
	}
	
	opts.push('buffers=' + encodeURIComponent(selected_buffers));
	opts.push('limit=' + encodeURIComponent(document.getElementById('input_search_limit').value));
	xhttp.send(opts.join('&'));

}

function GetElementIdByCaller(element) {
	messageid = Extract_MessageId(element);
	if (element.substr(0, 16) == 'open_message_id_') {
		return 'message_id_' + messageid;
	}
	return 'message_opened_' + Extract_OpenedMessageId(element) + '_' + messageid;
}

function MoreMessages(ElementId, direction)
{
	var callerElementId = GetElementIdByCaller(ElementId);
	var callerMessageId = Extract_MessageId(ElementId);
	
	document.getElementById(callerElementId).firstChild.innerHTML = '';
	document.getElementById(callerElementId).firstChild.className = 'no-nav-link';
	
	var openedMessageElementId = callerElementId;
	var openedMessageId = callerMessageId;
	
	if (direction & QuasselDB_Constants_Original_Message) {
		opened_messages[callerMessageId] = [];
	} else {
		openedMessageId = Extract_OpenedMessageId(callerElementId);
		openedMessageElementId = 'message_opened_' + openedMessageId + '_' + openedMessageId;
		if (direction & QuasselDB_Constants_Direction_Previous) {
			document.getElementById(opened_messages[openedMessageId][0]).firstChild.innerHTML = '';
			document.getElementById(opened_messages[openedMessageId][0]).firstChild.className = 'no-nav-link';
		}
		if (direction & QuasselDB_Constants_Direction_Next) {
			document.getElementById(opened_messages[openedMessageId][opened_messages[openedMessageId].length - 1]).firstChild.innerHTML = '';
			document.getElementById(opened_messages[openedMessageId][opened_messages[openedMessageId].length - 1]).firstChild.className = 'no-nav-link';
		}
	}
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState != 4 || this.status != 200) { return; }
		var reply = JSON.parse(this.responseText);
	
		var lastElementId = callerElementId;

		for (var i = 0; i < reply.length; i++) {
			var newElementId = 'message_opened_' + openedMessageId + '_' + reply[i]['messageid'];
			
			if (!(direction & QuasselDB_Constants_Original_Message) || openedMessageId != reply[i]['messageid']) {
				opened_messages[openedMessageId].push(newElementId);
			}
			
			var newElement;
			if (direction & QuasselDB_Constants_Direction_Next) {
				newElement = AddElemAfterId(lastElementId, 'tr');
			} else {
				newElement = AddElemBeforeId(callerElementId, 'tr');
			}
			newElement.id = newElementId;
			lastElementId = newElementId;
			
			FillRowWithReply(reply[i], newElement);
			newElement.className = newElement.className + ' opened_message';
		}
		var elem = null;
		
		if (direction & QuasselDB_Constants_Original_Message) {
			CloseElementById(openedMessageElementId);
			elem = document.getElementById('message_opened_' + openedMessageId + '_' + callerMessageId);
			elem.firstChild.innerHTML = '<a href="#" id="close_message_id_' + openedMessageId + '" onclick="CloseMessages(this.id); return false;"><span>Close messages</span></a>';
			elem.firstChild.className = 'close-link';
		}
		
		if (direction & QuasselDB_Constants_Direction_Previous) {
			if (reply.length == 0) {
				alert('No more messages');
			} else if (reply[0]['messageid'] != callerMessageId) {
				elem = document.getElementById('message_opened_' + openedMessageId + '_' + reply[0]['messageid']);
				elem.firstChild.innerHTML = '<a href="#" id="previous_message_' + openedMessageId + '_' + reply[0]['messageid'] + '" onclick="MoreMessages(this.id, QuasselDB_Constants_Direction_Previous); return false;"><span>Previous messages</span></a>';
				elem.firstChild.className = 'previous-link';
			} else {
				elem = document.getElementById('message_opened_' + openedMessageId + '_' + callerMessageId);
				elem.firstChild.innerHTML = '<a href="#" id="close_message_id_' + openedMessageId + '" onclick="CloseMessages(this.id); return false;"><span>Close messages</span></a>';
				elem.firstChild.className = 'close-link';
			}
		}
		
		if (direction & QuasselDB_Constants_Direction_Next) {
			if (reply.length == 0) {
				alert('No more messages');
			} else if (reply[reply.length - 1]['messageid'] != callerMessageId) {
				elem = document.getElementById('message_opened_' + openedMessageId + '_' + reply[(reply.length - 1)]['messageid']);
				elem.firstChild.innerHTML = '<a href="#" id="next_message_' + openedMessageId + '_' + reply[(reply.length - 1)]['messageid'] + '" onclick="MoreMessages(this.id, QuasselDB_Constants_Direction_Next); return false;"><span>Next messages</span></a>';
				elem.firstChild.className = 'next-link';
			} else {
				elem = document.getElementById('message_opened_' + openedMessageId + '_' + reply[reply.length - 1]['messageid']);
				elem.firstChild.innerHTML = '<a href="#" id="close_message_id_' + openedMessageId + '" onclick="CloseMessages(this.id); return false;"><span>Close messages</span></a>';
				elem.firstChild.className = 'close-link';
			}
		}
	};
	 
	xhttp.open("POST", "heart.php?moremessages", true);
	xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	
	var opts = [];
	opts.push('messageid=' + encodeURIComponent(messageid));
	opts.push('direction=' + encodeURIComponent(direction));
	opts.push('bufferid=' + encodeURIComponent(bufferids[messageid]));
	opts.push('limit=' + encodeURIComponent(document.getElementById('input_open_limit').value));
	
	xhttp.send(opts.join('&'));
}

function CloseMessages(messageid) {
	messageid = Extract_MessageId(messageid);
	for (var i = 0; i < opened_messages[messageid].length; i++) {
		CloseElementById(opened_messages[messageid][i]);
	}
	var elem = document.getElementById('message_opened_' + messageid + '_' + messageid);
	elem.id = 'message_id_' + messageid;
	elem.className = elem.className.split(' ')[0];
	elem.firstChild.innerHTML = '<a href="#" id="open_message_id_' + messageid + '" onclick="MoreMessages(this.id, QuasselDB_Constants_Direction_Next | QuasselDB_Constants_Direction_Previous | QuasselDB_Constants_Original_Message); return false;"><span>Show more messages</span></a>';
	elem.firstChild.className = 'open-link';
	opened_messages[messageid] = null;
}
