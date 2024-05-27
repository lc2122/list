import requests
from bs4 import BeautifulSoup
import time

def get_new_notifications():
    url = "https://insagirl-toto.appspot.com/hrm/?where=1"
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    notifications = soup.find_all('a', href=lambda href: href and href.startswith('https://lolcast.kr/#/player/'))
    return notifications

def main():
    seen_notifications = set()

    while True:
        new_notifications = get_new_notifications()

        for notification in new_notifications:
            notification_link = notification['href']
            if notification_link not in seen_notifications:
                print("새로운 알림:", notification_link)
                seen_notifications.add(notification_link)

        time.sleep(60)  # 60초마다 확인

if __name__ == "__main__":
    main()
