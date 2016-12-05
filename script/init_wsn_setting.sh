#!/bin/sh

#only remove subdirectoy
mkdir /home/adv/wsn_setting/device_html
cd /home/adv/wsn_setting/device_html
rm -Rf -- */

#remove all files
mkdir /home/adv/wsn_setting/device_table
cd /home/adv/wsn_setting/device_table
rm -rf *

#
cd /home/adv/APIGateway
node ./app.js

